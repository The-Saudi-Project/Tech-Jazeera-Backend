/**
 * User — a staff member who can LOG IN to the ERP.
 *
 * Deliberately separate from Employee (M4). A User is an account with a
 * password and a role; an Employee is a workforce record with passports,
 * visas and deployments. A deployed welder is an Employee but usually not a
 * User; the accountant is a User but may not be a deployed Employee. The two
 * have independent lifecycles, so they are separate collections (per our
 * references-over-embedding rule).
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
 */
export const ROLES = ['Admin', 'Manager', 'HR', 'Operations', 'Accounts', 'Viewer', 'Worker'];

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
    // P2-M1: links a login to its workforce record. Optional and null for
    // staff (an accountant is a User with no Employee). A Worker's login maps
    // to exactly ONE employee — enforced by the partial unique index below.
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
