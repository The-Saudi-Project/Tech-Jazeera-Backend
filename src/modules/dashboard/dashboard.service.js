/**
 * Dashboard service — one aggregation across every module for the management
 * overview. It adds no data of its own; it reads employees, clients,
 * deployments, quotations, documents and the audit log and rolls them up.
 *
 * All the independent queries run in parallel (Promise.all) so the whole
 * dashboard is one fast round-trip.
 *
 * HONESTY NOTE (updated P2-M8): Phase 1 had no cost data, so this module
 * originally reported only approved-quotation revenue and a payroll
 * run-rate estimate, never a fabricated profit number. Now that Invoices
 * (P2-M6), finalized Payroll (P2-M5) and Expenses (P2-M7) all exist, a real
 * profit figure — actual billed revenue minus actual payroll cost minus
 * actual expenses, for a real calendar month — is finally honest to show;
 * see computeMonthProfit()/getProfitOverview() below and finance.profit.
 */
import Employee, { WORKFORCE_TYPES } from '../employees/employee.model.js';
import Client from '../clients/client.model.js';
import Deployment from '../deployments/deployment.model.js';
import Quotation from '../quotations/quotation.model.js';
import Document from '../documents/document.model.js';
import AuditLog from '../audit/audit.model.js';
import Attendance from '../attendance/attendance.model.js';
import PayrollRun from '../payroll/payrollRun.model.js';
import Invoice from '../invoices/invoice.model.js';
import Expense from '../expenses/expense.model.js';
import { toUtcDay } from '../attendance/attendance.service.js';

export const EXPIRY_WARNING_DAYS = 30;
const TREND_MONTHS = 6;

/** "YYYY-MM" → { year, month (1-12), start, end } in UTC. Falls back to the
 *  current calendar month for anything missing/malformed — the query schema
 *  already rejects a malformed string before this runs, so this is really
 *  just the "no month given" default path. */
function resolveMonth(monthStr) {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1; // 1-12
  if (monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    year = y;
    month = m;
  }
  return {
    year,
    month,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/**
 * Real profit for one calendar month — the P2-M8 replacement for the old
 * "profit needs cost data" placeholder, now that Invoices (P2-M6), finalized
 * Payroll (P2-M5), and Expenses (P2-M7) all exist.
 *
 * Methodology, deliberately consistent across all three legs — each is
 * "what was recorded as happening in this month", not a mix of accrual and
 * cash-basis figures that wouldn't add up to anything real:
 *  - revenue: sum of Invoice.grandTotal for invoices ISSUED in the month
 *    (Invoice.date). Not the old approvedRevenue (any Approved quotation,
 *    whether ever invoiced or not) — this is the real billed figure.
 *  - payrollCost: the Finalized PayrollRun's totalNet for that exact
 *    (periodYear, periodMonth) — 0 if no run was ever finalized for it. A
 *    Draft run never counts; an un-finalized month simply has no payroll
 *    cost yet, same as PHASE2-PLAN.md's "Finalized payroll feeds the
 *    dashboard's real cost figure."
 *  - expenses: sum of Expense.amount recorded in the month (Expense.date).
 */
async function computeMonthProfit(year, month) {
  const { start, end } = resolveMonth(monthKey(year, month));
  const [invoiceAgg, payrollRun, expenseAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]),
    PayrollRun.findOne({ periodYear: year, periodMonth: month, status: 'Finalized' }).select('totalNet').lean(),
    Expense.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const revenue = invoiceAgg[0]?.total ?? 0;
  const payrollCost = payrollRun?.totalNet ?? 0;
  const expenses = expenseAgg[0]?.total ?? 0;
  return { month: monthKey(year, month), revenue, payrollCost, expenses, net: revenue - payrollCost - expenses };
}

/** The selected month's real P&L plus a trailing TREND_MONTHS-month history
 *  (oldest → newest, selected month last) for the dashboard's bar breakdown. */
async function getProfitOverview(monthStr) {
  const selected = resolveMonth(monthStr);
  const months = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    let y = selected.year;
    let m = selected.month - i;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    months.push({ y, m });
  }
  const trend = await Promise.all(months.map(({ y, m }) => computeMonthProfit(y, m)));
  return { ...trend[trend.length - 1], trend };
}

/** Employee identity documents whose expiry we surface on the dashboard —
 *  exported so the P3-F expiry-alert job (notifications/expiryAlert.job.js)
 *  checks exactly the same set, not a second hand-maintained list. */
export const IDENTITY_DOCS = [
  ['passport', 'Passport'],
  ['visa', 'Visa'],
  ['iqama', 'Iqama'],
  ['medical', 'Medical'],
  ['drivingLicense', 'Driving License'],
];

const daysUntil = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

/**
 * @param {object} [opts]
 * @param {number} [opts.thresholdDays] override the 30-day alert window (P2-M2,
 *   customizable per viewer — mirrors the same param on the employee list)
 * @param {string} [opts.month] "YYYY-MM" — the period the real-profit section
 *   (P2-M8) shows; defaults to the current calendar month.
 * @param {{role: string, userId: string}} [opts.actor] when actor.role is
 *   'Coordinator', every figure below is scoped to their own team: deployments,
 *   workforce counts, the clients their team is placed at, and expiring
 *   documents. Quotations/revenue, payroll, and recent activity are omitted
 *   entirely (null) for a Coordinator — not a scoping gap, a deliberate
 *   visibility line: salary figures and the audit-style activity feed are
 *   Admin/Manager/HR/Accounts territory, not something a team lead sees even
 *   for their own team. Quotations specifically also has no honest per-team
 *   figure to compute (Quotation only links to Client, not to any
 *   Employee/Coordinator) — same "never fabricate a figure the data doesn't
 *   support" rule the finance section already follows for profit.
 */
export async function getDashboard({ thresholdDays, month, actor } = {}) {
  const days = thresholdDays ?? EXPIRY_WARNING_DAYS;
  const threshold = new Date(Date.now() + days * 86_400_000);
  const identityExpiryOr = IDENTITY_DOCS.map(([key]) => ({
    [`${key}.expiry`]: { $ne: null, $lte: threshold },
  }));

  // A Coordinator's entire dashboard is scoped to their own team. Computed
  // once, ahead of the parallel batch below, so every filter that needs it
  // shares the same scope.
  const isCoordinator = actor?.role === 'Coordinator';
  const teamIds = isCoordinator
    ? await Employee.find({ coordinator: actor.userId, type: { $in: WORKFORCE_TYPES } }).distinct('_id')
    : null;

  const employeeExpiryFilter = { status: { $ne: 'Exited' }, $or: identityExpiryOr };
  if (teamIds) employeeExpiryFilter._id = { $in: teamIds };

  const documentExpiryFilter = { expiryDate: { $ne: null, $lte: threshold } };
  if (teamIds) Object.assign(documentExpiryFilter, { ownerType: 'Employee', owner: { $in: teamIds } });

  const deploymentFilter = { status: 'Active' };
  if (teamIds) deploymentFilter.worker = { $in: teamIds };

  // "Active Workers"/"Workforce by status" mean the supplied workforce —
  // both Client (our own, supplied to clients) and Subcontracted (sourced
  // from an outside subcontractor) count here; only Own-type internal staff
  // are excluded. Payroll's own aggregate below stays Client-only.
  const employeeStatusFilter = { type: { $in: WORKFORCE_TYPES }, ...(teamIds ? { _id: { $in: teamIds } } : {}) };

  const markedTodayFilter = { date: toUtcDay(new Date()) };
  if (teamIds) markedTodayFilter.employee = { $in: teamIds };

  const [
    deployedActive,
    empStatusAgg,
    payrollAgg,
    activeClients,
    quoteAgg,
    expiringEmployees,
    expiringDocs,
    recentActivity,
    pendingClientApprovals,
    markedToday,
    profitOverview,
  ] = await Promise.all([
    Deployment.countDocuments(deploymentFilter),
    Employee.aggregate([{ $match: employeeStatusFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    // Payroll — skipped entirely for a Coordinator, see the doc comment above.
    // type: 'Client' — this figure is the supplied workforce's pay, not
    // internal staff salaries (an Own-type employee's salary, if ever set,
    // must never silently flow into this).
    isCoordinator
      ? Promise.resolve([])
      : Employee.aggregate([
          { $match: { status: { $ne: 'Exited' }, type: 'Client' } },
          { $group: { _id: null, total: { $sum: '$salary' } } },
        ]),
    // A Coordinator's "clients" are the distinct clients their team is
    // currently placed at — not every client in the system. approvalStatus:
    // 'Approved' on the company-wide count — a client still Pending isn't
    // really "active" in the business sense yet (it also can't have any
    // deployments, so the Coordinator branch is already implicitly correct).
    teamIds
      ? Deployment.find({ status: 'Active', worker: { $in: teamIds } }).distinct('client').then((ids) => ids.length)
      : Client.countDocuments({ status: 'Active', approvalStatus: 'Approved' }),
    // Skipped entirely for a Coordinator — see the doc comment above.
    isCoordinator
      ? Promise.resolve([])
      : Quotation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } }]),
    Employee.find(employeeExpiryFilter)
      .select('fullName employeeId passport visa iqama medical drivingLicense')
      .lean(),
    Document.find(documentExpiryFilter)
      .populate('owner', 'fullName companyName')
      .limit(50)
      .lean(),
    // Recent activity — skipped entirely for a Coordinator, see the doc comment above.
    isCoordinator
      ? Promise.resolve([])
      : AuditLog.find({}).sort({ createdAt: -1 }).limit(8).populate('user', 'name').lean(),
    // Company-wide, same visibility line as recentActivity above — a
    // Coordinator doesn't see this either (they'd only ever see their own
    // submissions' status on the client itself, not a company-wide count).
    isCoordinator ? Promise.resolve(null) : Client.countDocuments({ approvalStatus: 'Pending' }),
    // "Marked today" — a workforce-activity count, not a financial figure, so
    // (unlike payroll/revenue/activity above) it stays visible to a
    // Coordinator, scoped to their own team via markedTodayFilter.
    Attendance.countDocuments(markedTodayFilter),
    // P2-M8 real profit — skipped entirely for a Coordinator, same visibility
    // line as payroll/revenue above.
    isCoordinator ? Promise.resolve(null) : getProfitOverview(month),
  ]);

  // Workforce by status
  const workforceByStatus = { Active: 0, 'On Leave': 0, Exited: 0 };
  for (const row of empStatusAgg) workforceByStatus[row._id] = row.count;
  const totalWorkers = Object.values(workforceByStatus).reduce((a, b) => a + b, 0);

  // Quotations by status + finance
  const quotationsByStatus = { Draft: 0, Approved: 0, Rejected: 0 };
  let approvedRevenue = 0;
  let pendingRevenue = 0;
  for (const row of quoteAgg) {
    quotationsByStatus[row._id] = row.count;
    if (row._id === 'Approved') approvedRevenue = row.total;
    if (row._id === 'Draft') pendingRevenue = row.total;
  }

  // Merge expiring employee identity docs + uploaded documents, soonest first
  const expiringDocuments = [];
  for (const e of expiringEmployees) {
    for (const [key, label] of IDENTITY_DOCS) {
      const expiry = e[key]?.expiry;
      if (expiry && new Date(expiry) <= threshold) {
        expiringDocuments.push({
          source: 'Employee',
          ownerId: e._id,
          ownerName: e.fullName,
          ref: e.employeeId,
          label,
          expiry,
          daysLeft: daysUntil(expiry),
        });
      }
    }
  }
  for (const d of expiringDocs) {
    expiringDocuments.push({
      source: 'Document',
      ownerId: d.owner?._id ?? null,
      ownerName: d.owner?.fullName ?? d.owner?.companyName ?? 'Unknown',
      ref: d.category,
      label: d.title,
      expiry: d.expiryDate,
      daysLeft: daysUntil(d.expiryDate),
    });
  }
  expiringDocuments.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

  return {
    stats: {
      deployedActive,
      activeWorkers: workforceByStatus.Active,
      onLeave: workforceByStatus['On Leave'],
      totalWorkers,
      activeClients,
      pendingQuotations: teamIds ? null : quotationsByStatus.Draft,
      expiringSoon: expiringDocuments.length,
      pendingClientApprovals,
      markedToday,
    },
    finance: {
      approvedRevenue: isCoordinator ? null : approvedRevenue,
      pendingRevenue: isCoordinator ? null : pendingRevenue,
      monthlyPayroll: isCoordinator ? null : (payrollAgg[0]?.total ?? 0),
      // P2-M8 — real profit for the selected month (revenue from actually
      // issued invoices, cost from a finalized payroll run and recorded
      // expenses) plus a trailing 6-month trend. null for a Coordinator,
      // same visibility line as the three estimates above.
      profit: profitOverview,
    },
    workforceByStatus,
    quotationsByStatus: isCoordinator ? null : quotationsByStatus,
    expiringDocuments: expiringDocuments.slice(0, 10),
    recentActivity: isCoordinator ? null : recentActivity,
  };
}
