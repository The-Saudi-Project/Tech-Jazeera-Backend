/**
 * StaffAttendance — a Coordinator, HR, or Accounts account's own sign-in/
 * sign-out for one calendar day. Deliberately a SEPARATE collection from
 * Attendance, not a reuse of it: Attendance is keyed to an Employee (workforce/payroll
 * data), and this is keyed to a User (a login). Admin/Manager don't need
 * this — they're exempt from clocking in — and Workers already have their
 * own equivalent via Employee-based Attendance + the ESS portal.
 *
 * Nothing here ever touches the Employee collection, so it can never skew
 * Active Workers, Monthly Payroll, or any workforce report — see the
 * decision behind this in docs/PHASE2-PLAN.md.
 */
import mongoose from 'mongoose';

const staffAttendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true }, // UTC midnight of the calendar day
    // Same self-punch shape as Attendance's Worker path — see
    // attendance.service.js selfPunch() for the exact semantics (first punch
    // sets checkInTime, every later one pushes checkOutTime forward).
    verifiedBy: { type: String, enum: ['geofence', 'officeIp'], default: null },
    selfMarkLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      distanceMeters: { type: Number, default: null },
    },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    hoursWorked: { type: Number, default: null },
  },
  { timestamps: true }
);

// One record per user per day (the upsert key).
staffAttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('StaffAttendance', staffAttendanceSchema);
