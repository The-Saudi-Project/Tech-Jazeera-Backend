/**
 * LeaveRequest — one employee's request against one LeaveType.
 *
 * `eligibility` is a SNAPSHOT computed and frozen at submission time (never
 * trust the client, and never silently recompute history if the LeaveType's
 * policy changes later — the same discipline as quotation totals). It is what
 * lets the UI show *why* a request was auto-approved or sent for review.
 */
import mongoose from 'mongoose';

export const LEAVE_REQUEST_STATUSES = [
  'AutoApproved',
  'PendingReview',
  'Approved',
  'Rejected',
  'Cancelled',
];

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    // Snapshot — a request stays readable even if the type is later renamed
    // or deactivated.
    leaveTypeName: { type: String, required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 }, // inclusive calendar days
    reason: { type: String, trim: true, maxlength: 500 },

    status: { type: String, enum: LEAVE_REQUEST_STATUSES, default: 'PendingReview' },

    eligibility: {
      continuousServiceMonths: { type: Number, default: 0 },
      entitlementDays: { type: Number, default: 0 },
      usedDays: { type: Number, default: 0 },
      remainingDays: { type: Number, default: 0 },
      ruleApplied: { type: String, default: '' }, // human-readable, shown in the UI
      // Only set for 'Sick' requests: how these specific days split
      // across the LeaveType's pay tiers, e.g. [{days:5,payPercent:100},
      // {days:5,payPercent:75}]. Frozen here at submission time, same
      // reasoning as everything else in `eligibility` — payroll
      // (payroll.service.js's sickLeaveDeductionForMonth) reads THIS
      // snapshot, never re-derives it from the current LeaveType, so an
      // already-decided request's pay never silently changes if the
      // company edits its sick-pay tiers later.
      payBreakdown: {
        type: [{ days: Number, payPercent: Number, _id: false }],
        default: undefined,
      },
    },

    // P2-M2: auto-approval is a right, not a manager's call (per policy), but
    // the coordinator/manager still gets it as a NOTICE they can see and flag
    // a real-world conflict against. This is that "seen it" flag — the same
    // read-signal idiom the app already uses (expiry alerts), not a new
    // notification system.
    acknowledgedByManager: { type: Boolean, default: false },

    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// An employee's own history, newest first (My Leave, and overlap checks).
leaveRequestSchema.index({ employee: 1, createdAt: -1 });
// The staff review queue, filtered by status.
leaveRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('LeaveRequest', leaveRequestSchema);
