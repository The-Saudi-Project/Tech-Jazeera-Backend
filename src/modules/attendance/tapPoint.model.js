/**
 * TapPoint — a physical NFC tag a Worker taps to sign in/out (e.g. one per
 * room). Its token is embedded in the URL written to the chip; visiting that
 * URL as an authenticated Worker toggles check-in/check-out for the day (see
 * attendance.service.js's selfTap()). Deliberately doesn't track WHICH tap
 * point a Worker used in the Attendance record itself — only that they
 * tapped somewhere — this is presence/hours tracking, not room occupancy.
 * The tap point's name is kept in the audit log for traceability only.
 */
import mongoose from 'mongoose';

const tapPointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    token: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('TapPoint', tapPointSchema);
