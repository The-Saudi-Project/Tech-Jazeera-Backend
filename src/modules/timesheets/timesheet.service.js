/**
 * Timesheet service — aggregates a week of real Attendance data and runs it
 * through submit/approve/reject. See timesheet.model.js for why this
 * doesn't duplicate hour-entry.
 *
 * KNOWN LIMITATION (documented, not silently glossed over): approving a
 * timesheet does not yet lock its underlying Attendance days against
 * further edits. There is no Payroll consumer yet to protect against a
 * post-approval change — see docs/P2-M3b-notes.md for the reasoning and
 * what adding the lock would touch.
 */
import AttendanceModel from '../attendance/attendance.model.js';
import Employee from '../employees/employee.model.js';
import Timesheet from './timesheet.model.js';
import { resolveWeeklyCap } from '../ramadan/ramadanPeriod.service.js';
import { notifyEmployeeUser } from '../notifications/notification.service.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Labor Law Article 98: 8 hours/day, 48 hours/week — the fixed statutory
// normal week used whenever a timesheet's week doesn't overlap a configured
// Ramadan period (see ../ramadan/ramadanPeriod.model.js for why the
// Ramadan cap itself IS configurable but this baseline isn't).
const NORMAL_WEEKLY_HOURS = 48;

/** The Saturday..Friday (KSA week) bounds containing `date` — mirrors the
 *  client's attendance.dates.js weekRange() exactly, in UTC Date form. */
function weekBoundsFor(date) {
  const d = new Date(date);
  const sinceSaturday = (d.getUTCDay() + 1) % 7;
  const start = new Date(d.getTime() - sinceSaturday * 86_400_000);
  const periodStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const periodEnd = new Date(periodStart.getTime() + 6 * 86_400_000);
  return { periodStart, periodEnd };
}

/**
 * Sum a week's Attendance into a Timesheet's totals.
 *   - Present with a real self-punched hoursWorked → that figure.
 *   - Present with no clock times (a staff bulk-mark) → the employee's own
 *     expectedDailyHours, if one is set on file — never an invented default.
 *   - Absent/Off contribute 0 hours; Leave/Sick are tracked separately, not
 *     summed as worked hours.
 *   - overtimeHours (P3-E): whatever totalHours exceeds this week's
 *     threshold — NORMAL_WEEKLY_HOURS (48), or the configured Ramadan
 *     weeklyHours cap if [periodStart, periodEnd] overlaps a RamadanPeriod.
 */
async function computeTotals(employee, periodStart, periodEnd) {
  const records = await AttendanceModel.find({
    employee: employee._id,
    date: { $gte: periodStart, $lte: periodEnd },
  }).lean();

  let totalHours = 0;
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLeaveOrSick = 0;
  let daysOff = 0;

  for (const r of records) {
    if (r.status === 'Present') {
      daysPresent += 1;
      totalHours += r.hoursWorked ?? employee.expectedDailyHours ?? 0;
    } else if (r.status === 'Absent') {
      daysAbsent += 1;
    } else if (r.status === 'Leave' || r.status === 'Sick') {
      daysLeaveOrSick += 1;
    } else if (r.status === 'Off') {
      daysOff += 1;
    }
  }

  const ramadanWeeklyCap = await resolveWeeklyCap(periodStart, periodEnd);
  const weeklyThreshold = ramadanWeeklyCap ?? NORMAL_WEEKLY_HOURS;
  const overtimeHours = money(Math.max(0, totalHours - weeklyThreshold));

  return {
    totalHours: money(totalHours),
    daysPresent,
    daysAbsent,
    daysLeaveOrSick,
    daysOff,
    recordedDays: records.length,
    overtimeHours,
  };
}

export async function submitTimesheet(employeeId, data, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const { periodStart, periodEnd } = weekBoundsFor(data.periodStart);
  if (periodStart > new Date()) {
    throw new ApiError(400, 'You cannot submit a timesheet for a week that has not started.');
  }

  const totals = await computeTotals(employee, periodStart, periodEnd);
  const existing = await Timesheet.findOne({ employee: employeeId, periodStart });

  let timesheet;
  if (existing) {
    if (existing.status !== 'Rejected') {
      throw new ApiError(409, `This week's timesheet is already ${existing.status.toLowerCase()}.`);
    }
    Object.assign(existing, totals, {
      status: 'Submitted',
      notes: data.notes,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
    timesheet = await existing.save();
  } else {
    timesheet = await Timesheet.create({
      employee: employeeId,
      periodStart,
      periodEnd,
      ...totals,
      notes: data.notes,
    });
  }

  await logAudit({
    user: actor.userId,
    action: 'timesheet.submit',
    targetType: 'Timesheet',
    targetId: timesheet._id,
    meta: { employeeId: employee.employeeId, periodStart: periodStart.toISOString().slice(0, 10), totalHours: totals.totalHours },
    ip: actor.ip,
  });
  return timesheet.toObject();
}

export async function listOwnTimesheets(employeeId, { page, limit }) {
  const filter = { employee: employeeId };
  const [items, total] = await Promise.all([
    Timesheet.find(filter).sort({ periodStart: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Timesheet.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listTimesheets({ page, limit, status, employee }) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  const [items, total] = await Promise.all([
    Timesheet.find(filter)
      .sort({ periodStart: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .lean(),
    Timesheet.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function decideTimesheet(id, { status, decisionNote }, actor) {
  const timesheet = await Timesheet.findById(id);
  if (!timesheet) throw new ApiError(404, 'Timesheet not found.');
  if (timesheet.status !== 'Submitted') throw new ApiError(400, 'Only a submitted timesheet can be decided.');

  timesheet.status = status;
  timesheet.decidedBy = actor.userId;
  timesheet.decidedAt = new Date();
  timesheet.decisionNote = decisionNote;
  await timesheet.save();

  await logAudit({
    user: actor.userId,
    action: `timesheet.${status.toLowerCase()}`,
    targetType: 'Timesheet',
    targetId: timesheet._id,
    meta: { decisionNote },
    ip: actor.ip,
  });
  await notifyEmployeeUser(timesheet.employee, {
    type: 'RequestStatus',
    title: `Timesheet ${status.toLowerCase()}`,
    body: `Week of ${timesheet.periodStart.toISOString().slice(0, 10)}${decisionNote ? ` — ${decisionNote}` : ''}`,
    url: '/me/attendance',
  });
  return timesheet.toObject();
}

/** Approve many Submitted timesheets at once (the plan's "bulk approve a week"). */
export async function bulkApproveTimesheets(ids, actor) {
  const result = await Timesheet.updateMany(
    { _id: { $in: ids }, status: 'Submitted' },
    { status: 'Approved', decidedBy: actor.userId, decidedAt: new Date() }
  );
  await logAudit({
    user: actor.userId,
    action: 'timesheet.bulkApprove',
    meta: { requested: ids.length, approved: result.modifiedCount },
    ip: actor.ip,
  });
  return { requested: ids.length, approved: result.modifiedCount };
}
