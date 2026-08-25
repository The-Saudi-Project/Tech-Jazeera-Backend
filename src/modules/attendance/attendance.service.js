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
      // in place (which would silently defeat selfMark()'s protection
      // against a Worker overwriting a staff-set record right back).
      update: {
        $set: {
          status: r.status,
          note: r.note ?? '',
          source: 'staff',
          verifiedBy: null,
          selfMarkLocation: { lat: null, lng: null, accuracy: null, distanceMeters: null },
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
 * A Worker marks their OWN attendance as Present, verified either by GPS
 * geofence or by their request coming from an allow-listed office IP —
 * P2-M3's replacement for "connect to the office WiFi" (browsers can't read
 * a WiFi network's name, so this checks the actual network the request
 * arrived from instead; see docs/P2-M3-notes.md for why).
 *
 * A record staff already set for today is NOT overwritten — self-mark is the
 * primary path, but staff correction always wins (P2-M3 decision).
 */
export async function selfMark({ employeeId, lat, lng, accuracy }, actor) {
  const office = await OfficeLocation.findOne().lean();
  if (!office) {
    throw new ApiError(400, 'Office location has not been set up yet — ask your Admin to configure it.');
  }

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
        ? `You're about ${distance}m from the office — within ${office.radiusMeters}m (or on the office network) is required to mark attendance.`
        : 'Could not read your location. Enable location access and try again, or connect to the office network.'
    );
  }

  const day = toUtcDay(new Date());
  const existing = await Attendance.findOne({ employee: employeeId, date: day }).lean();
  if (existing && existing.source === 'staff') {
    throw new ApiError(409, "Today's attendance was already set by your office. Contact HR if this needs to change.");
  }

  const record = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: day },
    {
      $set: {
        status: 'Present',
        source: 'self',
        verifiedBy: geofenceOk ? 'geofence' : 'officeIp',
        selfMarkLocation: { lat: lat ?? null, lng: lng ?? null, accuracy: accuracy ?? null, distanceMeters: distance },
      },
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  await logAudit({
    user: actor.userId,
    action: 'attendance.selfmark',
    targetType: 'Attendance',
    targetId: record._id,
    meta: { date: day.toISOString().slice(0, 10), verifiedBy: record.verifiedBy, distanceMeters: distance },
    ip: actor.ip,
  });

  return record;
}
