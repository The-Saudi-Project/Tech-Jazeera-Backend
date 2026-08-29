/**
 * ExitReentryRequest — a worker's request for a Single or Multiple Exit
 * Re-Entry visa (PRD Module 6), the Jawazat/Muqeem permit an Iqama holder
 * needs to leave Saudi Arabia and return while still employed.
 *
 * This app tracks the REQUEST and its approval, not the government process
 * itself — there is no public API to actually issue one. Once Approved, HR
 * processes it externally (Muqeem/Jawazat) and records the outcome here via
 * `markIssued` (a reference number, for HR's own tracking) — the same
 * "we track the request, a human does the paperwork" shape as
 * CertificateRequest's ChamberOfCommerceAttestation type.
 */
import mongoose from 'mongoose';

export const VISA_TYPES = ['Single', 'Multiple'];
export const EXIT_REENTRY_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Issued'];

const exitReentrySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    visaType: { type: String, enum: VISA_TYPES, required: true },
    departureDate: { type: Date, required: true },
    // For 'Single': the planned return date. For 'Multiple': the requested
    // validity end date (it permits repeated trips until then).
    expectedReturnDate: { type: Date, required: true },
    // Optional — "linked to annual leave" per the PRD. Ownership (same
    // employee) is checked at submission; it is NOT required to already be
    // Approved, since a worker often requests the visa while leave is still
    // pending review.
    linkedLeaveRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null },
    reason: { type: String, trim: true, maxlength: 500 },

    status: { type: String, enum: EXIT_REENTRY_STATUSES, default: 'Pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500 },

    issuedAt: { type: Date, default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    visaReferenceNumber: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

exitReentrySchema.index({ employee: 1, createdAt: -1 });
exitReentrySchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ExitReentryRequest', exitReentrySchema);
