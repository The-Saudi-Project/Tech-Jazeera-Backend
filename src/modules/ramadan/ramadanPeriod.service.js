/**
 * RamadanPeriod service — plain CRUD over the company Ramadan calendar,
 * mirrors holiday.service.js exactly. `resolveWeeklyCap()` is the one
 * consumer-facing function timesheet.service.js calls to find whether a
 * given week overlaps a configured Ramadan period.
 */
import RamadanPeriod from './ramadanPeriod.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

/** Ramadan periods overlapping [from, to] (either end optional). */
export async function listRamadanPeriods({ from, to } = {}) {
  const filter = {};
  if (from) filter.endDate = { $gte: from };
  if (to) filter.startDate = { $lte: to };
  return RamadanPeriod.find(filter).sort({ startDate: 1 }).lean();
}

/**
 * The Ramadan weekly-hours cap for a timesheet week, or null if that week
 * doesn't overlap any configured Ramadan period. If more than one period
 * somehow overlaps (a data-entry mistake — periods aren't meant to
 * overlap), the SMALLEST cap wins, the safer (more worker-protective)
 * reading rather than an arbitrary "first match".
 */
export async function resolveWeeklyCap(periodStart, periodEnd) {
  const overlapping = await RamadanPeriod.find({
    startDate: { $lte: periodEnd },
    endDate: { $gte: periodStart },
  })
    .select('weeklyHours')
    .lean();
  if (overlapping.length === 0) return null;
  return Math.min(...overlapping.map((p) => p.weeklyHours));
}

export async function createRamadanPeriod(data, actor) {
  const period = await RamadanPeriod.create(data);
  await logAudit({
    user: actor.userId,
    action: 'ramadanPeriod.create',
    targetType: 'RamadanPeriod',
    targetId: period._id,
    meta: { label: period.label, weeklyHours: period.weeklyHours },
    ip: actor.ip,
  });
  return period.toObject();
}

export async function updateRamadanPeriod(id, data, actor) {
  const period = await RamadanPeriod.findById(id);
  if (!period) throw new ApiError(404, 'Ramadan period not found.');

  const startDate = data.startDate ?? period.startDate;
  const endDate = data.endDate ?? period.endDate;
  if (endDate < startDate) throw new ApiError(400, 'End date cannot be before the start date.');

  Object.assign(period, data);
  await period.save();

  await logAudit({
    user: actor.userId,
    action: 'ramadanPeriod.update',
    targetType: 'RamadanPeriod',
    targetId: period._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return period.toObject();
}

export async function deleteRamadanPeriod(id, actor) {
  const period = await RamadanPeriod.findByIdAndDelete(id);
  if (!period) throw new ApiError(404, 'Ramadan period not found.');

  await logAudit({
    user: actor.userId,
    action: 'ramadanPeriod.delete',
    targetType: 'RamadanPeriod',
    targetId: period._id,
    meta: { label: period.label },
    ip: actor.ip,
  });
}
