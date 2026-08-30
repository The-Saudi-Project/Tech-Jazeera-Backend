/**
 * RamadanPeriod — the company-confirmed Ramadan date range for a given
 * Hijri year, plus its reduced working-hour caps (P3-E).
 *
 * Deliberately NOT computed from a formula, exactly like Holiday (P3-B):
 * Ramadan follows the Hijri lunar calendar (moon-sighting based) and shifts
 * ~11 days earlier every Gregorian year, so this is an Admin/Manager/HR-
 * entered calendar, re-confirmed every year — same "don't invent it"
 * discipline as everything else in this app.
 *
 * `dailyHours`/`weeklyHours` are configurable, not hardcoded to Labor Law
 * Article 98's default 6/36 — the plan explicitly asks for "configurable
 * Ramadan hour caps" (a company may already run shorter hours, or the
 * figure may be revised), defaulting to the statutory numbers but editable.
 * The NON-Ramadan normal week (48 hours, also Article 98) is NOT
 * configurable here — it's the fixed statutory baseline used whenever a
 * timesheet's week doesn't overlap any RamadanPeriod; see
 * timesheets/timesheet.service.js's NORMAL_WEEKLY_HOURS.
 */
import mongoose from 'mongoose';

const ramadanPeriodSchema = new mongoose.Schema(
  {
    // e.g. "Ramadan 1447" — informational, not parsed; startDate/endDate
    // (Gregorian) are what every date-range query actually uses.
    label: { type: String, required: true, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    dailyHours: { type: Number, default: 6, min: 1, max: 8 },
    weeklyHours: { type: Number, default: 36, min: 6, max: 48 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Range queries (timesheet overtime calc, "is this week in Ramadan" checks).
ramadanPeriodSchema.index({ startDate: 1 });

export default mongoose.model('RamadanPeriod', ramadanPeriodSchema);
