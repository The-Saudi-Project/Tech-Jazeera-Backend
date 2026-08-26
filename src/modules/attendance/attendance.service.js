/**
 * Attendance service — marking, views, and summary aggregation.
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Attendance, { ATTENDANCE_STATUSES } from './attendance.model.js';
import OfficeLocation from './officeLocation.model.js';
import TapPoint from './tapPoint.model.js';
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
 * A Worker signs themselves IN for the day — verified either by GPS geofence
 * or office-IP (see verifyOfficeLocation). Marks the day Present and opens a
 * shift; selfCheckOut() closes it and computes the hours worked.
 *
 * A record staff already set for today is NOT overwritten — self check-in is
 * the primary path, but staff correction always wins (P2-M3 decision). A
 * worker who already completed today's shift (checked out) can't check in
 * again — one shift per calendar day, matching the one-record-per-day model.
 */
export async function selfCheckIn({ employeeId, lat, lng, accuracy }, actor) {
  const office = await requireOfficeLocation();
  const { verifiedBy, distance } = verifyOfficeLocation(office, { lat, lng }, actor);

  const openShift = await Attendance.findOne({
    employee: employeeId,
    checkInTime: { $ne: null },
    checkOutTime: null,
  }).lean();
  if (openShift) {
    throw new ApiError(409, "You're already signed in — sign out before signing in again.");
  }

  const day = toUtcDay(new Date());
  const existing = await Attendance.findOne({ employee: employeeId, date: day }).lean();
  if (existing?.source === 'staff') {
    throw new ApiError(409, "Today's attendance was already set by your office. Contact HR if this needs to change.");
  }
  if (existing?.checkOutTime) {
    throw new ApiError(409, `You've already completed today's shift (${existing.hoursWorked} hrs).`);
  }

  const now = new Date();
  const record = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: day },
    {
      $set: {
        status: 'Present',
        source: 'self',
        verifiedBy,
        selfMarkLocation: { lat: lat ?? null, lng: lng ?? null, accuracy: accuracy ?? null, distanceMeters: distance },
        checkInTime: now,
        checkOutTime: null,
        hoursWorked: null,
      },
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  await logAudit({
    user: actor.userId,
    action: 'attendance.checkin',
    targetType: 'Attendance',
    targetId: record._id,
    meta: { date: day.toISOString().slice(0, 10), verifiedBy, distanceMeters: distance },
    ip: actor.ip,
  });

  return record;
}

/**
 * A Worker signs themselves OUT, closing the shift selfCheckIn() opened and
 * computing hoursWorked. Finds the most recent open shift rather than
 * strictly "today's" record so an overnight shift (check in before midnight,
 * out after) still closes correctly.
 */
export async function selfCheckOut({ employeeId, lat, lng, accuracy }, actor) {
  const office = await requireOfficeLocation();
  verifyOfficeLocation(office, { lat, lng }, actor); // throws if not at/near the office

  const openShift = await Attendance.findOne({
    employee: employeeId,
    checkInTime: { $ne: null },
    checkOutTime: null,
  }).sort({ checkInTime: -1 });
  if (!openShift) {
    throw new ApiError(400, "You haven't signed in yet today.");
  }

  const now = new Date();
  const hoursWorked = Math.round(((now - openShift.checkInTime) / 3_600_000) * 100) / 100;
  const record = await Attendance.findByIdAndUpdate(
    openShift._id,
    { $set: { checkOutTime: now, hoursWorked } },
    { new: true, runValidators: true }
  ).lean();

  await logAudit({
    user: actor.userId,
    action: 'attendance.checkout',
    targetType: 'Attendance',
    targetId: record._id,
    meta: { hoursWorked },
    ip: actor.ip,
  });

  return record;
}

// -------------------------------------------------------------- Tap points

function generateTapToken() {
  return crypto.randomBytes(12).toString('base64url'); // 16 chars, URL-safe
}

async function uniqueTapToken() {
  let token = generateTapToken();
  while (await TapPoint.exists({ token })) token = generateTapToken(); // astronomically unlikely, guarded anyway
  return token;
}

/** Physical NFC tap points (e.g. one per room) a Worker can tap to sign in/out. */
export async function listTapPoints() {
  return TapPoint.find().sort({ name: 1 }).lean();
}

export async function createTapPoint({ name, direction }, actor) {
  const token = await uniqueTapToken();
  const point = await TapPoint.create({ name, direction, token });
  await logAudit({
    user: actor.userId,
    action: 'attendance.tapPoint.create',
    targetType: 'TapPoint',
    targetId: point._id,
    meta: { name, direction },
    ip: actor.ip,
  });
  return point.toObject();
}

export async function updateTapPoint(id, data, actor) {
  const point = await TapPoint.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  if (!point) throw new ApiError(404, 'Tap point not found.');
  await logAudit({
    user: actor.userId,
    action: 'attendance.tapPoint.update',
    targetType: 'TapPoint',
    targetId: id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return point;
}

/** New token → the old URL dies immediately; the physical chip must be rewritten. */
export async function rotateTapPointToken(id, actor) {
  const point = await TapPoint.findById(id);
  if (!point) throw new ApiError(404, 'Tap point not found.');
  point.token = await uniqueTapToken();
  await point.save();
  await logAudit({
    user: actor.userId,
    action: 'attendance.tapPoint.rotate',
    targetType: 'TapPoint',
    targetId: id,
    ip: actor.ip,
  });
  return point.toObject();
}

export async function deleteTapPoint(id, actor) {
  const point = await TapPoint.findByIdAndDelete(id).lean();
  if (!point) throw new ApiError(404, 'Tap point not found.');
  await logAudit({
    user: actor.userId,
    action: 'attendance.tapPoint.delete',
    targetType: 'TapPoint',
    targetId: id,
    meta: { name: point.name },
    ip: actor.ip,
  });
}

/**
 * A Worker taps a physical NFC tag (e.g. at a room entrance) instead of
 * pressing the Sign in/Sign out button in the app — same underlying
 * check-in/out, same geofence/office-IP verification, just triggered by a
 * tap. The tap point's direction decides the action, not the worker's
 * current state: an 'in' point always attempts a check-in, an 'out' point
 * always attempts a check-out — that's what makes the name on the physical
 * tag actually mean something. selfCheckIn/selfCheckOut's own guards
 * (already signed in, already completed today, never signed in) still fire
 * as normal 409/400s — deliberately not swallowed, since "you tapped the
 * wrong tag" IS the correct feedback in that case; the worker's own Sign
 * in/Sign out buttons in My Attendance remain the fallback for whichever
 * direction isn't covered by a physical tag at hand. Deliberately doesn't
 * care WHICH specific tap point of that direction was used (P2-M3+ decision:
 * overall presence, not room occupancy) — the point's name is logged for
 * audit-trail context only.
 */
export async function selfTap({ employeeId, token, lat, lng, accuracy }, actor) {
  const point = await TapPoint.findOne({ token, active: true }).lean();
  if (!point) {
    throw new ApiError(404, 'This tap point was not recognized. Ask your Admin to check it.');
  }

  const action = point.direction === 'in' ? 'checked-in' : 'checked-out';
  const record =
    point.direction === 'in'
      ? await selfCheckIn({ employeeId, lat, lng, accuracy }, actor)
      : await selfCheckOut({ employeeId, lat, lng, accuracy }, actor);

  await logAudit({
    user: actor.userId,
    action: 'attendance.tap',
    targetType: 'Attendance',
    targetId: record._id,
    meta: { tapPoint: point.name, direction: point.direction, action },
    ip: actor.ip,
  });

  return { action, record, tapPoint: point.name };
}
