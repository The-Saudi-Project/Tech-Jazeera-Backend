/**
 * Employee — the person record for everyone in the company except Admin
 * (NOT a login account; that's User — see user.model.js. `type` below is
 * what used to be this model's whole reason for existing: it only ever
 * represented the deployed/supplied workforce. Every internal login
 * (Manager/HR/Accounts/Coordinator) now gets one too).
 *
 * Schema choices, justified:
 *  - `type` splits the population this record can represent: 'Client' is the
 *    original meaning (workforce supplied to clients — visa/iqama-tracked,
 *    salary counted in payroll); 'Own' is internal staff (Manager/HR/IT/
 *    Office roles), who may have none of that compliance paperwork. See the
 *    conditional `required` on nationality/mobile/joiningDate/salary below.
 *  - Documents (passport/visa/iqama/medical/driving license) are EMBEDDED:
 *    they live and die with the employee and are never queried on their own,
 *    which is exactly our embed-vs-reference rule. Same for emergencyContact.
 *  - currentClient is a REFERENCE (ObjectId → Client): clients have their own
 *    independent lifecycle (M5), and one client relates to many employees.
 *    In M4 it stays null — assignment is the deployment workflow's job (M6),
 *    not an HR form field, so guards against double-assignment live there.
 *  - No soft-delete flag: status 'Exited' is the business-level "gone";
 *    hard delete stays for records created by mistake.
 */
import mongoose from 'mongoose';

/** Single source of truth for status values — validation and UI import it. */
export const EMPLOYEE_STATUSES = ['Active', 'On Leave', 'Exited'];
/** 'Own' = internal staff (reports to a Manager). 'Client' = the workforce
 *  supplied to clients (mapped to a Coordinator and/or a Manager). */
export const EMPLOYEE_TYPES = ['Own', 'Client'];

/** Only 'Client' employees carry the compliance/payroll fields below as required. */
function requiredForClient() {
  return this.type === 'Client';
}

/**
 * Reusable sub-schema for an identity/compliance document. _id disabled —
 * these are plain value objects, not entities.
 */
const documentSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true },
    expiry: { type: Date },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    // Company-assigned code (e.g. AJ-0042). Uppercased for consistent lookups;
    // the unique index also backs duplicate detection (409 via error handler).
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    fullName: { type: String, required: true, trim: true },
    // 'Own' = internal staff; 'Client' = workforce supplied to clients.
    type: { type: String, enum: EMPLOYEE_TYPES, required: true, default: 'Client' },
    nationality: { type: String, required: requiredForClient, trim: true },
    mobile: { type: String, required: requiredForClient, trim: true },
    // Optional — many field workers have no email. NOT unique for that reason.
    email: { type: String, trim: true, lowercase: true },

    passport: { type: documentSchema, default: () => ({}) },
    visa: { type: documentSchema, default: () => ({}) },
    iqama: { type: documentSchema, default: () => ({}) },
    medical: { type: documentSchema, default: () => ({}) },
    drivingLicense: { type: documentSchema, default: () => ({}) },

    joiningDate: { type: Date, required: requiredForClient },
    designation: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    // Monthly salary in SAR. Number (not string) so M10 can aggregate costs.
    // Required only for Client — this is the figure Monthly Payroll sums, and
    // that figure is deliberately scoped to the supplied workforce, not
    // internal staff pay (see dashboard.service.js).
    salary: { type: Number, required: requiredForClient, min: 0 },
    accommodation: { type: String, trim: true },

    // The minimum shift length before My Attendance warns this Worker on an
    // early sign-out (e.g. 9.5). Per-employee because it genuinely varies by
    // role/contract — null means no warning is shown for them at all, not a
    // fallback to some hardcoded company-wide number. Set by Admin/Manager/HR
    // from the employee form, same write circle as the rest of the record.
    expectedDailyHours: { type: Number, default: null, min: 0, max: 24 },

    // The single fixed day this employee is normally off (0=Sun..6=Sat,
    // matching Date#getUTCDay() and attendance.dates.js's isWeekend
    // convention). Defaults to Friday (5) for anyone no one has explicitly
    // configured; null means "no fixed weekly off" (e.g. rotating shifts).
    // The Records grid uses this to INFER an Off day when no real Attendance
    // record exists — never written to Attendance itself, and a real record
    // for that day always wins over this default.
    weeklyOffDay: { type: Number, default: 5, min: 0, max: 6 },

    // Managed by the deployment workflow from M6 — never set via the HR form.
    currentClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    currentSite: { type: String, trim: true, default: null },

    // P2-M2: the Coordinator user responsible for this employee's day-to-day
    // (leave decisions, expiry follow-up). Optional — HR/Manager/Admin assign
    // it from the employee form, same write circle as the rest of the record.
    // Referential integrity (must actually be a 'Coordinator' user) is checked
    // in the service layer, not here — Mongoose refs don't validate the target.
    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // The Admin/Manager this employee reports to — universal across both
    // types: every 'Own' employee has one (Coordinator/HR/IT/Office all
    // report to a Manager), and a 'Client' employee may have one too,
    // alongside or instead of a coordinator. Referential integrity (must be
    // Admin or Manager) is checked in the service layer, same as coordinator.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Who created this record — null for records predating this field. Lets
    // Admin/Manager/HR see, at a glance, which employees a Coordinator added
    // themselves (self-service, no approval — see docs/PHASE2-PLAN.md).
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    status: { type: String, enum: EMPLOYEE_STATUSES, default: 'Active' },

    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

// The list screen sorts by these; without indexes every sort is a full scan.
employeeSchema.index({ fullName: 1 });
employeeSchema.index({ createdAt: -1 });
// A coordinator's team, and the "my team" scoping filter (P2-M2).
employeeSchema.index({ coordinator: 1 });
// A manager's direct reports, and the type filter used across dashboard/
// attendance/deployment scoping (see employee.service.js listEmployees).
employeeSchema.index({ manager: 1 });
employeeSchema.index({ type: 1 });

export default mongoose.model('Employee', employeeSchema);
