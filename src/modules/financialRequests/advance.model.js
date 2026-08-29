/**
 * SalaryAdvance — a worker's own request for an advance against future
 * salary (PRD Module 4). Repayment is tracked here MANUALLY (a ledger of
 * recorded payments) rather than auto-deducted from payroll — there is no
 * Payroll module yet (see docs/PHASE2-PLAN.md P2-M5). Once Payroll exists,
 * it becomes the natural place to post repayments automatically instead of
 * a staff member recording them by hand; this model doesn't need to change
 * shape for that, only who calls addRepayment().
 *
 * No multi-level approval matrix: same decision as the deferred timesheet
 * signing flow (P2-M3) — a concrete multi-level hierarchy needs a real
 * threshold/level spec from the user, not an invented one. Single-level
 * Submit -> Approve/Reject today; upgradeable later without breaking this
 * shape (see docs/P3-C-notes.md).
 */
import mongoose from 'mongoose';

export const ADVANCE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Closed'];

/** One recorded repayment. _id disabled — a value object, append-only, never
 *  individually edited or removed (same convention as Document's versions). */
const repaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 200 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const advanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, maxlength: 500 },
    // How many months the worker proposes to repay over — informational
    // until Payroll can act on it automatically.
    repaymentMonths: { type: Number, min: 1, max: 24, default: 1 },

    status: { type: String, enum: ADVANCE_STATUSES, default: 'Pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500 },

    repayments: { type: [repaymentSchema], default: [] },
  },
  { timestamps: true }
);

// An employee's own request history; the staff review queue by status.
advanceSchema.index({ employee: 1, createdAt: -1 });
advanceSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('SalaryAdvance', advanceSchema);
