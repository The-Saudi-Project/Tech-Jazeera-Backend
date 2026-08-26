/**
 * Dashboard service — one aggregation across every module for the management
 * overview. It adds no data of its own; it reads employees, clients,
 * deployments, quotations, documents and the audit log and rolls them up.
 *
 * All the independent queries run in parallel (Promise.all) so the whole
 * dashboard is one fast round-trip.
 *
 * HONESTY NOTE: the brief mentions "estimated profit", but Phase 1 tracks no
 * costs/expenses (invoices/purchasing are later phases). We therefore report
 * only figures the data actually supports — approved-quotation revenue,
 * pending pipeline, and monthly payroll from real salaries — and never a
 * fabricated profit number.
 */
import Employee from '../employees/employee.model.js';
import Client from '../clients/client.model.js';
import Deployment from '../deployments/deployment.model.js';
import Quotation from '../quotations/quotation.model.js';
import Document from '../documents/document.model.js';
import AuditLog from '../audit/audit.model.js';

export const EXPIRY_WARNING_DAYS = 30;

/** Employee identity documents whose expiry we surface on the dashboard. */
const IDENTITY_DOCS = [
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
export async function getDashboard({ thresholdDays, actor } = {}) {
  const days = thresholdDays ?? EXPIRY_WARNING_DAYS;
  const threshold = new Date(Date.now() + days * 86_400_000);
  const identityExpiryOr = IDENTITY_DOCS.map(([key]) => ({
    [`${key}.expiry`]: { $ne: null, $lte: threshold },
  }));

  // A Coordinator's entire dashboard is scoped to their own team. Computed
  // once, ahead of the parallel batch below, so every filter that needs it
  // shares the same scope.
  const isCoordinator = actor?.role === 'Coordinator';
  const teamIds = isCoordinator ? await Employee.find({ coordinator: actor.userId }).distinct('_id') : null;

  const employeeExpiryFilter = { status: { $ne: 'Exited' }, $or: identityExpiryOr };
  if (teamIds) employeeExpiryFilter._id = { $in: teamIds };

  const documentExpiryFilter = { expiryDate: { $ne: null, $lte: threshold } };
  if (teamIds) Object.assign(documentExpiryFilter, { ownerType: 'Employee', owner: { $in: teamIds } });

  const deploymentFilter = { status: 'Active' };
  if (teamIds) deploymentFilter.worker = { $in: teamIds };

  const employeeStatusFilter = teamIds ? { _id: { $in: teamIds } } : {};

  const [
    deployedActive,
    empStatusAgg,
    payrollAgg,
    activeClients,
    quoteAgg,
    expiringEmployees,
    expiringDocs,
    recentActivity,
  ] = await Promise.all([
    Deployment.countDocuments(deploymentFilter),
    Employee.aggregate([{ $match: employeeStatusFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    // Payroll — skipped entirely for a Coordinator, see the doc comment above.
    isCoordinator
      ? Promise.resolve([])
      : Employee.aggregate([
          { $match: { status: { $ne: 'Exited' } } },
          { $group: { _id: null, total: { $sum: '$salary' } } },
        ]),
    // A Coordinator's "clients" are the distinct clients their team is
    // currently placed at — not every client in the system.
    teamIds
      ? Deployment.find({ status: 'Active', worker: { $in: teamIds } }).distinct('client').then((ids) => ids.length)
      : Client.countDocuments({ status: 'Active' }),
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
    },
    finance: {
      approvedRevenue: isCoordinator ? null : approvedRevenue,
      pendingRevenue: isCoordinator ? null : pendingRevenue,
      monthlyPayroll: isCoordinator ? null : (payrollAgg[0]?.total ?? 0),
    },
    workforceByStatus,
    quotationsByStatus: isCoordinator ? null : quotationsByStatus,
    expiringDocuments: expiringDocuments.slice(0, 10),
    recentActivity: isCoordinator ? null : recentActivity,
  };
}
