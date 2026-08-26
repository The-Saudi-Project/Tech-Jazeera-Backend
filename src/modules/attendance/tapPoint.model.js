/**
 * TapPoint — a physical NFC tag a Worker taps to sign in/out (e.g. one per
 * room entrance and one per exit). Its token is embedded in the URL written
 * to the chip; visiting that URL as an authenticated Worker attempts a
 * check-in (direction 'in') or check-out (direction 'out') — see
 * attendance.service.js's selfTap(). Direction is fixed per tap point, not
 * inferred from the worker's current state: a point named "...In" always
 * attempts check-in even if the worker already has one open, which is what
 * makes the name on the physical tag actually mean something (an earlier
 * toggle-based version didn't — either tag did whichever action the
 * worker's current state happened to favor). Deliberately doesn't track
 * WHICH tap point a Worker used in the Attendance record itself — only that
 * they tapped somewhere — this is presence/hours tracking, not room
 * occupancy. The tap point's name and direction are kept in the audit log
 * for traceability only.
 */
import mongoose from 'mongoose';

export const TAP_DIRECTIONS = ['in', 'out'];

const tapPointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    token: { type: String, required: true, unique: true },
    direction: { type: String, enum: TAP_DIRECTIONS, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('TapPoint', tapPointSchema);
