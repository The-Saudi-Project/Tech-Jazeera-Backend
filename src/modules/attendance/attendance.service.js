/**
 * Attendance service — marking, views, and summary aggregation.
 */
import mongoose from 'mongoose';
import Attendance, { ATTENDANCE_STATUSES } from './attendance.model.js';
import OfficeLocation from './officeLocation.model.js';
import Employee from '../employees/employee.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';
import { distanceMeters } from '../../utils/geo.js';

/** Floor a `YYYY-MM-DD` (or Date) to UTC midnight — the canonical day value. */
export function toUtcDay(input) {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Inclusive [from, to] day range as a Mongo date filter. */
function dayRangeFilter(from, to) {
  return { $gte: toUtcDay(from), $lte: toUtcDay(to) };
}

/**
 * Mark (upsert) many workers for one day. Idempotent: re-marking a day
 * overwrites that day's status rather than creating duplicates.
 */
export async function markBulk({ date, records }, actor) {
  const day = toUtcDay(date);

  // Integrity: refuse the whole batch if any employee id is bogus, rather
  // than silently writing orphan attendance rows.
  const ids = [...new Set(records.map((r) => r.employee))];
  const existing = await Employee.countDocuments({ _id: { $in: ids } });
  if (existing !== ids.length) {
    throw new ApiError(400, 'One or more selected workers no longer exist.');
  }

  const ops = records.map((r) => ({
    updateOne: {
      filter: { employee: r.employee, date: day },
      // source: 'staff' is explicit and unconditional here — this is the
      // "staff always wins" override (P2-M3): if today was previously
      // self-marked, this asserts staff authority over it and clears the
      // now-stale self-mark provenance, rather than leaving `source: 'self'`
      // in place (which would silently defeat selfCheckIn()'s protection
      // against a Worker overwriting a staff-set record right back).
      update: {
        $set: {
          status: r.status,
          note: r.note ?? '',
          source: 'staff',
          verifiedBy: null,
          selfMarkLocation: { lat: null, lng: null, accuracy: null, distanceMeters: null },
          // A staff override has no clock times to show — clear any check-in/out
          // a Worker had in progress for this day, same "staff always wins" reasoning
          // as the fields above (a stale open check-in must not survive a staff write).
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: null,
        },
      },
      upsert: true,
    },
  }));
  await Attendance.bulkWrite(ops);

  await logAudit({
    user: actor.userId,
    action: 'attendance.mark',
    meta: { date, count: records.length },
    ip: actor.ip,
  });
  return { date, marked: records.length };
}

/**
 * Raw records in a date range (for the week/month grid). Employee is
 * populated so the grid can label rows. Capped so an over-wide range can't
 * pull the whole collection.
 */
export async function listAttendance({ from, to, employee }) {
  const filter = { date: dayRangeFilter(from, to) };
  if (employee) filter.employee = employee;
  return Attendance.find(filter)
    .populate('employee', 'fullName employeeId')
    .sort({ date: 1 })
    .limit(10_000)
    .lean();
}

/**
 * Per-employee counts per status over a range (the summary + export source).
 * One aggregation returns a row per worker with a column per status.
 */
export async function getSummary({ from, to, employee }) {
  const match = { date: dayRangeFilter(from, to) };
  if (employee) match.employee = new mongoose.Types.ObjectId(employee);

  const countIf = (status) => ({ $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } });
  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$employee',
        Present: countIf('Present'),
        Absent: countIf('Absent'),
        Leave: countIf('Leave'),
        Sick: countIf('Sick'),
        Off: countIf('Off'),
        total: { $sum: 1 },
      },
    },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'emp' } },
    { $unwind: '$emp' },
    {
      $project: {
        _id: 0,
        employee: '$_id',
        employeeId: '$emp.employeeId',
        fullName: '$emp.fullName',
        Present: 1,
        Absent: 1,
        Leave: 1,
        Sick: 1,
        Off: 1,
        total: 1,
      },
    },
    { $sort: { fullName: 1 } },
  ]);

  return { from, to, statuses: ATTENDANCE_STATUSES, rows };
}

/** The geofence config — Admin-only to view/set, null until first configured. */
export async function getOfficeLocation() {
  return OfficeLocation.findOne().lean();
}

export async function setOfficeLocation(data, actor) {
  const loc = await OfficeLocation.findOneAndUpdate({}, data, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  }).lean();
  await logAudit({
    user: actor.userId,
    action: 'officeLocation.update',
    targetType: 'OfficeLocation',
    targetId: loc._id,
    meta: { name: loc.name, radiusMeters: loc.radiusMeters, allowedIpCount: loc.allowedIps.length },
    ip: actor.ip,
  });
  return loc;
}

/**
 * Verify a Worker's location against the configured office, either by GPS
 * geofence or by their request coming from an allow-listed office IP —
 * P2-M3's replacement for "connect to the office WiFi" (browsers can't read
 * a WiFi network's name, so this checks the actual network the request
 * arrived from instead; see docs/P2-M3-notes.md for why). Shared by both
 * check-in and check-out — hours only mean something if both ends of the
 * shift were verified, not just the start.
 */
function verifyOfficeLocation(office, { lat, lng }, actor) {
  const ipOk = office.allowedIps.includes(actor.ip);
  let distance = null;
  let geofenceOk = false;
  if (lat != null && lng != null) {
    distance = Math.round(distanceMeters(lat, lng, office.lat, office.lng));
    geofenceOk = distance <= office.radiusMeters;
  }

  if (!geofenceOk && !ipOk) {
    throw new ApiError(
      403,
      distance != null
        ? `You're about ${distance}m from the office — within ${office.radiusMeters}m (or on the office network) is required.`
        : 'Could not read your location. Enable location access and try again, or connect to the office network.'
    );
  }
  return { verifiedBy: geofenceOk ? 'geofence' : 'officeIp', distance };
}

async function requireOfficeLocation() {
  const office = await OfficeLocation.findOne().lean();
  if (!office) {
    throw new ApiError(400, 'Office location has not been set up yet — ask your Admin to configure it.');
  }
  return office;
}

/**
 * A Worker records a "punch" via the Sign in/Sign out buttons in My
 * Attendance:
 *
 *   - The FIRST punch of the day sets checkInTime and marks the day Present.
 *     checkInTime never changes again for that day.
 *   - EVERY punch after that pushes checkOutTime forward to now and
 *     recomputes hoursWorked from the fixed checkInTime. There is no
 *     "closed" state and no error for punching again — a worker can leave
 *     for an errand, come back, and punch any number of times without it
 *     failing. Only the very first and very last punch of the day end up
 *     mattering for hoursWorked.
 *
 * (An earlier version modeled a single open/closed "shift" that had to be
 * checked in before it could be checked out, and couldn't be reopened once
 * closed — replaced because "sign out then sign in again" needed to just
 * work, not 409. A physical-NFC-tap variant of this was also built and then
 * reverted at the user's request — scope is in-app buttons only; see git
 * history before this revert if a tap-based flow is ever wanted again.)
 *
 * KNOWN LIMITATION, accepted deliberately: because only the first and last
 * punch count, an unaccounted gap — leaving for three hours without
 * punching again until the end of the day — is invisible. hoursWorked will
 * include that gap. This is the tradeoff for letting a worker punch freely
 * without the app erroring if they sign out and back in the same day.
 *
 * A record staff already set for today is NOT overwritten — self-punching is
 * the primary path, but staff correction always wins (P2-M3 decision).
 */
export async function selfPunch({ employeeId, lat, lng, accuracy }, actor) {
  const office = await requireOfficeLocation();
  const { verifiedBy, distance } = verifyOfficeLocation(office, { lat, lng }, actor);

  const day = toUtcDay(new Date());
  const existing = await Attendance.findOne({ employee: employeeId, date: day }).lean();
  if (existing?.source === 'staff') {
    throw new ApiError(409, "Today's attendance was already set by your office. Contact HR if this needs to change.");
  }

  const now = new Date();
  const isFirstPunchToday = !existing?.checkInTime;

  const set = isFirstPunchToday
    ? {
        status: 'Present',
        source: 'self',
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

  const record = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: day },
    { $set: set },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  await logAudit({
    user: actor.userId,
    action: isFirstPunchToday ? 'attendance.checkin' : 'attendance.checkout',
    targetType: 'Attendance',
    targetId: record._id,
    meta: isFirstPunchToday
      ? { date: day.toISOString().slice(0, 10), verifiedBy, distanceMeters: distance }
      : { hoursWorked: record.hoursWorked },
    ip: actor.ip,
  });

  return { action: isFirstPunchToday ? 'checked-in' : 'checked-out', record };
}
