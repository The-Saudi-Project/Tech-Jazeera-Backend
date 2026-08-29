/**
 * User — a login account for the ERP.
 *
 * Deliberately separate from Employee: a User is credentials + a role; an
 * Employee is the person record (workforce details, documents, org
 * placement). Every non-Admin User is linked to exactly one Employee
 * (`employee` below) — the person's full details live there, not here.
 * Admin is the one exception: a pure system-access account with no workforce
 * presence, so it has no Employee. The two stay separate collections (not
 * merged into one) because logins and people still have independent
 * lifecycles — a person can exist with no login at all, and a login is
 * revoked/deactivated without deleting the person record it came from.
 */
import mongoose from 'mongoose';

/**
 * Role list, exported as the single source of truth — rbac middleware,
 * validation schemas, and the seed script all import it from here so a new
 * role is added in exactly one place.
 *
 * `Worker` (added in P2-M1) is the self-service persona: a deployed employee
 * with a login that can see ONLY their own data. It is deliberately the last
 * entry and the odd one out — every OTHER role is "staff" (see STAFF_ROLES in
 * the rbac middleware), and the admin modules are staff-only.
 *
 * `Coordinator` (added in P2-M2) is staff, but scoped: they see and act on
 * only the Employees assigned to them (Employee.coordinator), not the whole
 * company. Everything else (Admin, Manager, HR, Accounts) keeps its existing
 * company-wide visibility — adding Coordinator does not narrow anyone else's
 * access.
 *
 * `Operations` and `Viewer` were removed after P2-M2 — never had a real
 * account and weren't part of the intended role set going forward. IT and
 * Office Staff are Employee.designation values, not roles — someone in
 * either position logs in as whichever of the roles above actually matches
 * their system access (typically HR or Accounts).
 */
export const ROLES = [
  'Admin',
  'Manager',
  'HR',
  'Accounts',
  'Coordinator',
  'Worker',
];

/** Roles eligible to be an Employee's `manager` (Employee.manager / .coordinator's manager). */
export const MANAGER_ELIGIBLE_ROLES = ['Admin', 'Manager'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // lowercase + unique index: 'Ali@x.com' and 'ali@x.com' are one account.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // `select: false` — the hash NEVER leaves the DB unless a query opts in
    // with .select('+passwordHash'). Prevents accidentally serializing it.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    // Soft on/off switch: deactivate a leaver instead of deleting them, so
    // their audit history keeps pointing at a real user.
    isActive: { type: Boolean, default: true },
    // Self-service profile photo — a public Cloudinary URL, or null. Every
    // role can set their own; see auth.service.js updateAvatar/removeAvatar.
    avatarUrl: { type: String, default: null },
    // Links a login to its person record. Universal for every non-Admin
    // login (Own or Client Employee.type alike) — null only for Admin.
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  { timestamps: true }
);

// One employee ↔ at most one login. A plain `unique: true` would treat every
// staff user's `employee: null` as a colliding duplicate; the partial filter
// applies the constraint ONLY to documents where employee is an ObjectId, so
// unlimited staff can coexist with null while linked employees stay unique.
userSchema.index(
  { employee: 1 },
  { unique: true, partialFilterExpression: { employee: { $type: 'objectId' } } }
);

export default mongoose.model('User', userSchema);
