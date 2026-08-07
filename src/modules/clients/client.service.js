/**
 * Client service — all client business logic. Controllers only translate HTTP.
 */
import Client from './client.model.js';
import Employee from '../employees/employee.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

/** Escape user text before embedding it in a $regex (injection / syntax). */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Paginated, searchable, sortable listing.
 * search   → case-insensitive match on company / contact / email / phone
 * status   → exact match
 * industry → case-insensitive partial match
 */
export async function listClients({ page, limit, search, status, industry, sortBy, sortOrder }) {
  const conditions = [];
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    conditions.push({
      $or: [{ companyName: rx }, { contactPerson: rx }, { email: rx }, { phone: rx }],
    });
  }
  if (status) conditions.push({ status });
  if (industry) conditions.push({ industry: { $regex: escapeRegex(industry), $options: 'i' } });
  const filter = conditions.length > 0 ? { $and: conditions } : {};

  // Secondary _id sort keeps pagination stable when the primary key ties.
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: 1 };

  const [items, total] = await Promise.all([
    Client.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Client.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getClient(id) {
  const client = await Client.findById(id).lean();
  if (!client) throw new ApiError(404, 'Client not found.');
  return client;
}

export async function createClient(data, actor) {
  const client = await Client.create(data);
  await logAudit({
    user: actor.userId,
    action: 'client.create',
    targetType: 'Client',
    targetId: client._id,
    meta: { companyName: client.companyName },
    ip: actor.ip,
  });
  return client.toObject();
}

export async function updateClient(id, data, actor) {
  const client = await Client.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean();
  if (!client) throw new ApiError(404, 'Client not found.');
  await logAudit({
    user: actor.userId,
    action: 'client.update',
    targetType: 'Client',
    targetId: client._id,
    meta: { companyName: client.companyName, fields: Object.keys(data) },
    ip: actor.ip,
  });
  return client;
}

export async function deleteClient(id, actor) {
  // Referential integrity: refuse to orphan employees still pointing here.
  // Assignment lands in M6; until then this count is 0, but the guard is real
  // and prevents a future foot-gun.
  const assigned = await Employee.countDocuments({ currentClient: id });
  if (assigned > 0) {
    throw new ApiError(
      409,
      `This client has ${assigned} assigned worker(s). Reassign or unassign them first.`
    );
  }

  const client = await Client.findByIdAndDelete(id).lean();
  if (!client) throw new ApiError(404, 'Client not found.');
  await logAudit({
    user: actor.userId,
    action: 'client.delete',
    targetType: 'Client',
    targetId: client._id,
    meta: { companyName: client.companyName },
    ip: actor.ip,
  });
}
