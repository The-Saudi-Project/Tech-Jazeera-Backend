/**
 * LeaveType — a manager-configurable leave policy (P2-M2), NOT hard-coded.
 * The whole point of this model is that "what leave exists and how it's
 * earned" is data an Admin/Manager can shape, not a fixed enum in code.
 *
 * Four recurrence shapes cover everything discussed for this ERP:
 *  - 'Annual'        — accrues every leave-year (Saudi annual leave, e.g. 21
 *                       days/year, optionally rising to `tierDaysPerYear`
 *                       after `tierYears` of service — Article 109 shape).
 *  - 'ContractCycle'  — unlocks once per fixed multi-year cycle (Gulf-common
 *                       "home leave" granted every N years of a contract,
 *                       e.g. 2 years), not annual.
 *  - 'Sick'           — a per-leave-year pool like 'Annual', but PAY tapers
 *                       across configurable tiers instead of being a flat
 *                       paid/unpaid — Saudi Labor Law Article 117's shape
 *                       (30 days full pay, 60 days at 75%, remainder
 *                       unpaid, 120 days/year total, by default). See
 *                       `sickPayTiers` below and leave.service.js's
 *                       evaluateSick().
 *  - 'Manual'         — no automatic entitlement math at all (Unpaid,
 *                       Emergency, …): every request goes to PendingReview.
 * See leave.service.js for how each shape is evaluated.
 */
import mongoose from 'mongoose';

export const LEAVE_RECURRENCES = ['Annual', 'ContractCycle', 'Sick', 'Manual'];

/** One pay tier for 'Sick' recurrence: the next `days` days of sick leave
 *  taken this leave year are paid at `payPercent`. Tiers are consumed in
 *  the order given — [{days:30,payPercent:100},{days:60,payPercent:75},
 *  {days:30,payPercent:0}] is Article 117's statutory default, but this is
 *  a real configurable field (not a hardcoded law), same as Ramadan's
 *  editable-but-defaulted hour caps (P3-E) — a company may pay more
 *  generously than the legal minimum. _id disabled: a value object, not an
 *  entity, replaced wholesale on edit. */
const sickPayTierSchema = new mongoose.Schema(
  {
    days: { type: Number, required: true, min: 1, max: 365 },
    payPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

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

    // 'Sick' fields — see sickPayTierSchema above. The annual entitlement
    // cap is simply the sum of every tier's `days` (e.g. 120), not a
    // separate field — one number to keep in sync, not two.
    sickPayTiers: { type: [sickPayTierSchema], default: null },

    // All types: nobody may even submit this type before this much
    // continuous service — the "must complete a contract period" gate.
    minServiceMonths: { type: Number, min: 0, max: 600, default: 0 },

    // Optional per-request ceiling — mainly for 'Manual' statutory categories
    // that Saudi Labor Law (or company policy) caps per event rather than
    // per year (e.g. Emergency Leave, 5 days). null = no cap, checked in
    // leave.service.js at submission time.
    maxDaysPerRequest: { type: Number, min: 1, max: 365, default: null },
    // Whether this leave is paid — informational for every OTHER recurrence
    // (Payroll doesn't dock pay for any of them today; only attendance
    // absence, separately, could). 'Sick' is the one exception with a real
    // payroll effect: its tiers (not this flag) say exactly how each day is
    // paid, and payroll.service.js's sickLeaveDeductionForMonth() reads
    // sickPayTiers, never this field, for Sick-type requests.
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
