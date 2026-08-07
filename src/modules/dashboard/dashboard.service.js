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

const EXPIRY_WARNING_DAYS = 30;

/** Employee identity documents whose expiry we surface on the dashboard. */
const IDENTITY_DOCS = [
  ['passport', 'Passport'],
  ['visa', 'Visa'],
  ['iqama', 'Iqama'],
  ['medical', 'Medical'],
  ['drivingLicense', 'Driving License'],
];

const daysUntil = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

export async function getDashboard() {
  const threshold = new Date(Date.now() + EXPIRY_WARNING_DAYS * 86_400_000);
  const identityExpiryOr = IDENTITY_DOCS.map(([key]) => ({
    [`${key}.expiry`]: { $ne: null, $lte: threshold },
  }));

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
    Deployment.countDocuments({ status: 'Active' }),
    Employee.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Employee.aggregate([
      { $match: { status: { $ne: 'Exited' } } },
      { $group: { _id: null, total: { $sum: '$salary' } } },
    ]),
    Client.countDocuments({ status: 'Active' }),
    Quotation.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
    ]),
    Employee.find({ status: { $ne: 'Exited' }, $or: identityExpiryOr })
      .select('fullName employeeId passport visa iqama medical drivingLicense')
      .lean(),
    Document.find({ expiryDate: { $ne: null, $lte: threshold } })
      .populate('owner', 'fullName companyName')
      .limit(50)
      .lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).populate('user', 'name').lean(),
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
      pendingQuotations: quotationsByStatus.Draft,
    },
    finance: {
      approvedRevenue,
      pendingRevenue,
      monthlyPayroll: payrollAgg[0]?.total ?? 0,
    },
    workforceByStatus,
    quotationsByStatus,
    expiringDocuments: expiringDocuments.slice(0, 10),
    recentActivity,
  };
}
