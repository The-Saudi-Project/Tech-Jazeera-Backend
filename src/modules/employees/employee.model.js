/**
 * Employee — a workforce record (NOT a login account; that's User, see M2).
 *
 * Schema choices, justified:
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
    nationality: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    // Optional — many field workers have no email. NOT unique for that reason.
    email: { type: String, trim: true, lowercase: true },

    passport: { type: documentSchema, default: () => ({}) },
    visa: { type: documentSchema, default: () => ({}) },
    iqama: { type: documentSchema, default: () => ({}) },
    medical: { type: documentSchema, default: () => ({}) },
    drivingLicense: { type: documentSchema, default: () => ({}) },

    joiningDate: { type: Date, required: true },
    designation: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    // Monthly salary in SAR. Number (not string) so M10 can aggregate costs.
    salary: { type: Number, required: true, min: 0 },
    accommodation: { type: String, trim: true },

    // Managed by the deployment workflow from M6 — never set via the HR form.
    currentClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    currentSite: { type: String, trim: true, default: null },

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

export default mongoose.model('Employee', employeeSchema);
