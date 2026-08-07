/**
 * Attendance service — marking, views, and summary aggregation.
 */
import mongoose from 'mongoose';
import Attendance, { ATTENDANCE_STATUSES } from './attendance.model.js';
import Employee from '../employees/employee.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

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
      update: { $set: { status: r.status, note: r.note ?? '' } },
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
