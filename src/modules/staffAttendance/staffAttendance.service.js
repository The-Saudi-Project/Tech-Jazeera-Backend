/**
 * Staff self-attendance service — Coordinator/HR/Accounts sign in/out. Mirrors
 * attendance.service.js's selfPunch() for a Worker almost exactly (same
 * geofence verification, same "first punch sets check-in, every later punch
 * pushes check-out forward" semantics) but against StaffAttendance/User
 * instead of Attendance/Employee — see staffAttendance.model.js for why
 * they're kept separate.
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
  const isFirstPunchToday = !existing?.checkInTime;

  const set = isFirstPunchToday
    ? {
        verifiedBy,
        selfMarkLocation: { lat: lat ?? null, lng: lng ?? null, accuracy: accuracy ?? null, distanceMeters: distance },
        checkInTime: now,
        checkOutTime: null,
        hoursWorked: null,
      }
    : {
        verifiedBy,
        checkOutTime: now,
        hoursWorked: Math.round(((now - existing.checkInTime) / 3_600_000) * 100) / 100,
      };

  const record = await StaffAttendance.findOneAndUpdate(
    { user: actor.userId, date: day },
    { $set: set },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  await logAudit({
    user: actor.userId,
    action: isFirstPunchToday ? 'staffAttendance.checkin' : 'staffAttendance.checkout',
    targetType: 'StaffAttendance',
    targetId: record._id,
    meta: isFirstPunchToday
      ? { date: day.toISOString().slice(0, 10), verifiedBy, distanceMeters: distance }
      : { hoursWorked: record.hoursWorked },
    ip: actor.ip,
  });

  return { action: isFirstPunchToday ? 'checked-in' : 'checked-out', record };
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
