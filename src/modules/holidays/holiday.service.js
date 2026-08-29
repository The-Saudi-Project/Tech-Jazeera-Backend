/**
 * Holiday service — plain CRUD over the company holiday calendar.
 */
import Holiday from './holiday.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

/** Holidays overlapping [from, to] (either end optional — an open-ended range). */
export async function listHolidays({ from, to } = {}) {
  const filter = {};
  if (from) filter.endDate = { $gte: from };
  if (to) filter.startDate = { $lte: to };
  return Holiday.find(filter).sort({ startDate: 1 }).lean();
}

export async function createHoliday(data, actor) {
  const holiday = await Holiday.create(data);
  await logAudit({
    user: actor.userId,
    action: 'holiday.create',
    targetType: 'Holiday',
    targetId: holiday._id,
    meta: { name: holiday.name },
    ip: actor.ip,
  });
  return holiday.toObject();
}

export async function updateHoliday(id, data, actor) {
  const holiday = await Holiday.findById(id);
  if (!holiday) throw new ApiError(404, 'Holiday not found.');

  const startDate = data.startDate ?? holiday.startDate;
  const endDate = data.endDate ?? holiday.endDate;
  if (endDate < startDate) throw new ApiError(400, 'End date cannot be before the start date.');

  Object.assign(holiday, data);
  await holiday.save();

  await logAudit({
    user: actor.userId,
    action: 'holiday.update',
    targetType: 'Holiday',
    targetId: holiday._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return holiday.toObject();
}

export async function deleteHoliday(id, actor) {
  const holiday = await Holiday.findByIdAndDelete(id);
  if (!holiday) throw new ApiError(404, 'Holiday not found.');

  await logAudit({
    user: actor.userId,
    action: 'holiday.delete',
    targetType: 'Holiday',
    targetId: holiday._id,
    meta: { name: holiday.name },
    ip: actor.ip,
  });
}
