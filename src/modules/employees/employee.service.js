/**
 * Employee service — all employee business logic. Controllers only translate
 * HTTP; nothing in here touches req/res.
 */
import Employee from './employee.model.js';
import User from '../auth/user.model.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword, generateTempPassword } from '../auth/auth.service.js';
import { logAudit } from '../audit/audit.service.js';

/**
 * A document counts as "needs attention" when it expires within this many
 * days (or already has). The client mirrors this constant for its badges —
 * if you change it, change client/src/lib/constants.js too.
 */
export const EXPIRY_WARNING_DAYS = 30;

/** Fields the expiry-alert filter inspects. */
const EXPIRY_FIELDS = [
  'passport.expiry',
  'visa.expiry',
  'iqama.expiry',
  'medical.expiry',
  'drivingLicense.expiry',
];

/** Escape user text before embedding it in a $regex — prevents both regex
 *  injection and accidental syntax errors from names like "O'Brien (Ops)". */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Paginated, searchable, sortable listing.
 * search  → case-insensitive match on name / employeeId / mobile / email
 * status  → exact match
 * alerts  → 'true' keeps only employees with a document expiring within
 *           EXPIRY_WARNING_DAYS (or already expired)
 * client  → only employees currently assigned to that client
 */
export async function listEmployees({
  page,
  limit,
  search,
  status,
  alerts,
  client,
  unassigned,
  sortBy,
  sortOrder,
}) {
  // Each condition is AND-ed; search and alerts are each internally OR-ed.
  const conditions = [];
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    conditions.push({
      $or: [{ fullName: rx }, { employeeId: rx }, { mobile: rx }, { email: rx }],
    });
  }
  if (status) conditions.push({ status });
  if (client) conditions.push({ currentClient: client });
  if (unassigned === 'true') conditions.push({ currentClient: null });
  if (alerts === 'true') {
    const threshold = new Date(Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
    // $lte against a Date matches only real dates — documents with no expiry
    // (null/absent) are naturally excluded.
    conditions.push({ $or: EXPIRY_FIELDS.map((field) => ({ [field]: { $lte: threshold } })) });
  }
  const filter = conditions.length > 0 ? { $and: conditions } : {};

  // Secondary _id sort keeps pagination stable when the primary key ties
  // (e.g. many employees created the same day).
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: 1 };

  const [items, total] = await Promise.all([
    Employee.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Employee.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getEmployee(id) {
  // Populate the current client's name so the profile can show/link it rather
  // than a raw id. currentClient is set by the deployment workflow (M6).
  const employee = await Employee.findById(id).populate('currentClient', 'companyName').lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');
  // P2-M1: surface whether this employee has a login so the profile can show
  // account status (and hide "create login" once one exists) without a second
  // round-trip. Minimal, non-sensitive fields only — never the hash.
  const login = await User.findOne({ employee: id }).select('email role isActive').lean();
  employee.login = login
    ? { id: login._id.toString(), email: login.email, role: login.role, isActive: login.isActive }
    : null;
  return employee;
}

/**
 * Provision a Worker login for an existing employee (P2-M1). Admin/HR only
 * (enforced on the route). Generates a temporary password, returns it ONCE to
 * the caller to hand over, and never stores or logs it in plaintext.
 *
 * Guards:
 *  - employee must exist (404)
 *  - employee must not already have a login (409) — the one-to-one link
 *  - a login needs an email: use the employee's, or one the admin supplies
 *    when the record has none (400 if neither)
 *  - that email must be free (409) — checked here for a clear message, with
 *    the User email/employee unique indexes as the final backstop on a race
 */
export async function createEmployeeLogin(employeeId, { email }, actor) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const existing = await User.findOne({ employee: employeeId }).lean();
  if (existing) throw new ApiError(409, 'This employee already has a login.');

  const loginEmail = email ?? employee.email;
  if (!loginEmail) {
    throw new ApiError(
      400,
      'This employee has no email on file — add one, or provide an email for the login.'
    );
  }

  const emailTaken = await User.findOne({ email: loginEmail }).lean();
  if (emailTaken) throw new ApiError(409, 'A user with this email already exists.');

  const tempPassword = generateTempPassword();
  const user = await User.create({
    name: employee.fullName,
    email: loginEmail,
    passwordHash: await hashPassword(tempPassword),
    role: 'Worker',
    employee: employee._id,
  });

  await logAudit({
    user: actor.userId,
    action: 'user.provision.worker',
    targetType: 'User',
    targetId: user._id,
    // Password is NEVER logged — only the identity of the account created.
    meta: { employeeId: employee.employeeId, email: loginEmail },
    ip: actor.ip,
  });

  return {
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    tempPassword,
  };
}

/** Duplicate employeeId is caught by the unique index → 409 via errorHandler. */
export async function createEmployee(data, actor) {
  const employee = await Employee.create(data);
  await logAudit({
    user: actor.userId,
    action: 'employee.create',
    targetType: 'Employee',
    targetId: employee._id,
    meta: { employeeId: employee.employeeId, fullName: employee.fullName },
    ip: actor.ip,
  });
  return employee.toObject();
}

export async function updateEmployee(id, data, actor) {
  const employee = await Employee.findByIdAndUpdate(id, data, {
    new: true, // return the updated document, not the stale one
    runValidators: true, // Mongoose skips schema validation on updates unless told
  }).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');
  await logAudit({
    user: actor.userId,
    action: 'employee.update',
    targetType: 'Employee',
    targetId: employee._id,
    meta: { employeeId: employee.employeeId, fields: Object.keys(data) },
    ip: actor.ip,
  });
  return employee;
}

export async function deleteEmployee(id, actor) {
  const employee = await Employee.findByIdAndDelete(id).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');
  await logAudit({
    user: actor.userId,
    action: 'employee.delete',
    targetType: 'Employee',
    targetId: employee._id,
    meta: { employeeId: employee.employeeId, fullName: employee.fullName },
    ip: actor.ip,
  });
}
