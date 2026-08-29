/**
 * Holiday — a company-wide public holiday or paid observance (P3-B), e.g.
 * Eid al-Fitr, Eid al-Adha, Saudi National Day, Founding Day.
 *
 * Deliberately NOT computed from a formula: Eid dates follow the Hijri lunar
 * calendar (moon-sighting based, not pure arithmetic) and shift by the
 * government's annual announcement, so this is an Admin/Manager/HR-entered
 * calendar, re-confirmed every year — same "don't invent it" discipline as
 * everything else in this app.
 *
 * A range (startDate..endDate), not a single day: multi-day holidays (Eid is
 * typically several days) are one record, not N single-day rows.
 *
 * Purely additive to Attendance: a date falling in a Holiday range is
 * inferred as non-working in the UI (see RecordsGrid.jsx), exactly like
 * Employee.weeklyOffDay's "Off" inference — never written to Attendance
 * itself, and a real attendance record for that day still wins (someone may
 * have worked the holiday for overtime).
 */
import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Saudi Labor Law Article 112: official holidays are paid. Kept
    // per-record (not hardcoded true) for the rare unpaid observance a
    // company might still want on the shared calendar.
    isPaid: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Range queries (attendance grid, "upcoming holidays" widgets) sort/filter by this.
holidaySchema.index({ startDate: 1 });

export default mongoose.model('Holiday', holidaySchema);
