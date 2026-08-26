/**
 * Staff self-attendance service — Coordinator/HR/Accounts sign in/out.
 * Unlike a Worker's free-punch model (attendance.service.js's selfPunch() —
 * any number of punches, only the first and last of the day ever matter),
 * this is a strict per-day toggle: whichever state you're in decides what
 * the NEXT punch does, so the UI only ever needs to show one button.
 * "Signed in" (checkInTime set, checkOutTime not) → this punch signs OUT and
 * adds the just-finished session's length to today's running total.
 * Anything else (never punched today, or already signed out) → this punch
 * starts a FRESH session: new checkInTime, checkOutTime cleared. A second
 * sign-in/out cycle the same day accumulates onto hoursWorked rather than
 * replacing it, so leaving for lunch and coming back adds up correctly.
 */
import StaffAttendance from './staffAttendance.model.js';
import { toUtcDay, requireOfficeLocation, verifyOfficeLocation } from '../attendance/attendance.service.js';
import { logAudit } from '../audit/audit.service.js';

/** Inclusive [from, to] day range as a Mongo date filter. */
function dayRangeFilter(from, to) {
  return { $gte: toUtcDay(from), $lte: toUtcDay(to) };
}

export async function selfPunch({ lat, lng, accuracy }, actor) {
  const office = await requireOfficeLocation();
  const { verifiedBy, distance } = verifyOfficeLocation(office, { lat, lng }, actor);

  const day = toUtcDay(new Date());
  const existing = await StaffAttendance.findOne({ user: actor.userId, date: day }).lean();
  const now = new Date();
  const isCurrentlySignedIn = Boolean(existing?.checkInTime) && !existing?.checkOutTime;

  const set = isCurrentlySignedIn
    ? {
        verifiedBy,
        checkOutTime: now,
        hoursWorked:
          Math.round(((existing.hoursWorked ?? 0) + (now - existing.checkInTime) / 3_600_000) * 100) / 100,
      }
    : {
        verifiedBy,
        selfMarkLocation: { lat: lat ?? null, lng: lng ?? null, accuracy: accuracy ?? null, distanceMeters: distance },
        checkInTime: now,
        checkOutTime: null,
        // hoursWorked is deliberately left untouched here — it's today's
        // running total across every completed session, not this session's.
      };

  const record = await StaffAttendance.findOneAndUpdate(
    { user: actor.userId, date: day },
    { $set: set },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  await logAudit({
    user: actor.userId,
    action: isCurrentlySignedIn ? 'staffAttendance.checkout' : 'staffAttendance.checkin',
    targetType: 'StaffAttendance',
    targetId: record._id,
    meta: isCurrentlySignedIn
      ? { hoursWorked: record.hoursWorked }
      : { date: day.toISOString().slice(0, 10), verifiedBy, distanceMeters: distance },
    ip: actor.ip,
  });

  return { action: isCurrentlySignedIn ? 'checked-out' : 'checked-in', record };
}

/** Own attendance history — defaults to the last 30 days when no range is given. */
export async function listMyAttendance(actor, { from, to } = {}) {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
  const filter = {
    user: actor.userId,
    date: dayRangeFilter(from ?? monthAgo.toISOString().slice(0, 10), to ?? today.toISOString().slice(0, 10)),
  };
  return StaffAttendance.find(filter).sort({ date: -1 }).limit(60).lean();
}
