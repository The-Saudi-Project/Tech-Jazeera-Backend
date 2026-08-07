/**
 * Attendance — one worker's status for one calendar day.
 *
 * Schema choices, justified:
 *  - `employee` is a REFERENCE (independent lifecycle). No client/site here:
 *    attendance is about the person's day (present/absent/leave), not their
 *    placement — that's what Deployment records. Keeping the two separate
 *    avoids coupling attendance to whether the worker happens to be deployed.
 *  - `date` is stored at **UTC midnight** of the calendar day. The service
 *    normalizes every incoming date to that boundary so "a day" has exactly
 *    one representation, which makes the unique index below reliable.
 *  - The compound unique index `{ employee, date }` guarantees at most one
 *    record per worker per day; re-marking a day is an upsert, not a duplicate.
 */
import mongoose from 'mongoose';

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Leave', 'Sick', 'Off'];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true }, // UTC midnight of the calendar day
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// One record per worker per day (the upsert key).
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
// Range scans by date (grid + summary) hit this.
attendanceSchema.index({ date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
