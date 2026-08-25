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
 *  - P2-M3: `source`/`verifiedBy`/`selfMarkLocation` record how a record came
 *    to exist. Self-marking is the Worker's own geofence-verified check-in;
 *    staff marking (the original M7 flow) remains the backup/override — see
 *    attendance.service.js's selfCheckIn()/selfCheckOut() for why a staff-set
 *    record can't be silently overwritten by a later self check-in.
 *  - `checkInTime`/`checkOutTime`/`hoursWorked`: only ever set by a Worker's
 *    own self check-in/out (staff bulk-marking a day clears them — a staff
 *    override has no clock times to show). `hoursWorked` is computed once,
 *    at checkout, and stored rather than derived on read — it's a durable
 *    fact about that day, same reasoning as the snapshot fields elsewhere.
 */
import mongoose from 'mongoose';

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Leave', 'Sick', 'Off'];
export const ATTENDANCE_SOURCES = ['staff', 'self'];
export const ATTENDANCE_VERIFICATION_METHODS = ['geofence', 'officeIp'];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true }, // UTC midnight of the calendar day
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    source: { type: String, enum: ATTENDANCE_SOURCES, default: 'staff' },
    verifiedBy: { type: String, enum: ATTENDANCE_VERIFICATION_METHODS, default: null },
    selfMarkLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null }, // meters, as reported by the device
      distanceMeters: { type: Number, default: null }, // computed distance from the office
    },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    hoursWorked: { type: Number, default: null }, // (checkOutTime - checkInTime) in hours, 2dp
  },
  { timestamps: true }
);

// One record per worker per day (the upsert key).
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
// Range scans by date (grid + summary) hit this.
attendanceSchema.index({ date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
