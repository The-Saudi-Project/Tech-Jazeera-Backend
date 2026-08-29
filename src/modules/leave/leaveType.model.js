/**
 * LeaveType — a manager-configurable leave policy (P2-M2), NOT hard-coded.
 * The whole point of this model is that "what leave exists and how it's
 * earned" is data an Admin/Manager can shape, not a fixed enum in code.
 *
 * Three recurrence shapes cover everything discussed for this ERP:
 *  - 'Annual'        — accrues every leave-year (Saudi annual leave, e.g. 21
 *                       days/year, optionally rising to `tierDaysPerYear`
 *                       after `tierYears` of service — Article 109 shape).
 *  - 'ContractCycle'  — unlocks once per fixed multi-year cycle (Gulf-common
 *                       "home leave" granted every N years of a contract,
 *                       e.g. 2 years), not annual.
 *  - 'Manual'         — no automatic entitlement math at all (Sick, Unpaid,
 *                       Emergency, …): every request goes to PendingReview.
 * See leave.service.js for how each shape is evaluated.
 */
import mongoose from 'mongoose';

export const LEAVE_RECURRENCES = ['Annual', 'ContractCycle', 'Manual'];

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    recurrence: { type: String, enum: LEAVE_RECURRENCES, required: true },

    // 'Annual' fields
    daysPerYear: { type: Number, min: 0, max: 365, default: null },
    // Optional tier: after `tierYears` of continuous service, entitlement
    // becomes `tierDaysPerYear` instead of `daysPerYear`. Both or neither.
    tierYears: { type: Number, min: 1, max: 50, default: null },
    tierDaysPerYear: { type: Number, min: 0, max: 365, default: null },

    // 'ContractCycle' fields
    cycleYears: { type: Number, min: 1, max: 20, default: null },
    daysPerCycle: { type: Number, min: 0, max: 365, default: null },

    // All types: nobody may even submit this type before this much
    // continuous service — the "must complete a contract period" gate.
    minServiceMonths: { type: Number, min: 0, max: 600, default: 0 },

    // Optional per-request ceiling — mainly for 'Manual' statutory categories
    // that Saudi Labor Law (or company policy) caps per event rather than
    // per year (e.g. Emergency Leave, 5 days). null = no cap, checked in
    // leave.service.js at submission time.
    maxDaysPerRequest: { type: Number, min: 1, max: 365, default: null },
    // Whether this leave is paid — informational today (no Payroll module
    // yet), but the PRD's statutory categories are explicit about it
    // ("Emergency Leave (5 days paid)") and Payroll (P2-M5) will need this
    // when it exists, so it's captured now rather than backfilled later.
    isPaid: { type: Boolean, default: true },

    // Deactivate instead of delete — existing LeaveRequests reference this
    // type by id (and keep a name snapshot), so deleting would either orphan
    // history or silently corrupt it. Same precedent as Employee's
    // status:'Exited' over hard delete.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('LeaveType', leaveTypeSchema);
