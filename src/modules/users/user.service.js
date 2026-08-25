/**
 * Staff-user service — provisioning and managing logins for staff roles
 * (everything except Worker; see employee.service.js for Worker logins).
 *
 * Added in P2-M2 so 'Coordinator' — and any future staff role — actually has
 * a way to get an account from inside the app, not just the seed:admin CLI.
 */
import User, { COORDINATOR_MANAGER_ROLES } from '../auth/user.model.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword, generateTempPassword } from '../auth/auth.service.js';
import { logAudit } from '../audit/audit.service.js';

const PUBLIC_FIELDS = 'name email role isActive managedBy createdAt';

/** A Coordinator's manager must exist and actually be Admin/Manager. */
async function assertValidManager(managedById) {
  if (!managedById) return;
  const manager = await User.findById(managedById).lean();
  if (!manager) throw new ApiError(400, 'Selected manager does not exist.');
  if (!COORDINATOR_MANAGER_ROLES.includes(manager.role)) {
    throw new ApiError(400, 'A coordinator must report to an Admin or Manager.');
  }
}

/** Listing for the Team admin screen, and for picker dropdowns (?role=Coordinator). */
export async function listStaffUsers({ role } = {}) {
  const filter = { role: { $ne: 'Worker' } };
  if (role) filter.role = role;
  return User.find(filter)
    .select(PUBLIC_FIELDS)
    .populate('managedBy', 'name email')
    .sort({ name: 1 })
    .lean();
}

/**
 * Provision a staff login. Same shape as Worker provisioning (P2-M1): a
 * random temp password is generated, returned ONCE in the response, and only
 * its bcrypt hash is ever stored — never invented, never logged in plaintext.
 */
export async function createStaffUser({ name, email, role, managedBy }, actor) {
  const existing = await User.findOne({ email }).lean();
  if (existing) throw new ApiError(409, 'A user with this email already exists.');

  let managerRef = null;
  if (role === 'Coordinator') {
    await assertValidManager(managedBy);
    managerRef = managedBy ?? null;
  } else if (managedBy) {
    throw new ApiError(400, 'Only a Coordinator can report to a manager.');
  }

  const tempPassword = generateTempPassword();
  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(tempPassword),
    role,
    managedBy: managerRef,
  });

  await logAudit({
    user: actor.userId,
    action: 'user.provision.staff',
    targetType: 'User',
    targetId: user._id,
    meta: { email, role },
    ip: actor.ip,
  });

  return {
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    tempPassword,
  };
}

/** Update role / manager link / active status for an existing staff login. */
export async function updateStaffUser(id, { role, managedBy, isActive }, actor) {
  const user = await User.findById(id);
  if (!user || user.role === 'Worker') throw new ApiError(404, 'Staff user not found.');

  if (isActive === false && user._id.toString() === actor.userId) {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }

  const nextRole = role ?? user.role;
  if (managedBy !== undefined) {
    if (nextRole === 'Coordinator') {
      await assertValidManager(managedBy);
      user.managedBy = managedBy ?? null;
    } else if (managedBy) {
      throw new ApiError(400, 'Only a Coordinator can report to a manager.');
    } else {
      user.managedBy = null;
    }
  } else if (role && nextRole !== 'Coordinator') {
    // Role changed away from Coordinator — a stale manager link would be
    // meaningless (and would wrongly include them in a manager's "my team").
    user.managedBy = null;
  }

  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();

  await logAudit({
    user: actor.userId,
    action: 'user.update.staff',
    targetType: 'User',
    targetId: user._id,
    meta: {
      fields: Object.keys({ role, managedBy, isActive }).filter(
        (k) => ({ role, managedBy, isActive })[k] !== undefined
      ),
    },
    ip: actor.ip,
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    managedBy: user.managedBy,
  };
}
