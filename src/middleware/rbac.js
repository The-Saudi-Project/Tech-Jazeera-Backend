/**
 * requireRoles — decides WHAT an authenticated user may do.
 *
 * Usage (always AFTER requireAuth in the chain):
 *   router.get('/', requireAuth, requireRoles('Admin', 'HR'), controller)
 *
 * Authentication (who are you) and authorization (what may you do) are kept
 * as two middlewares because most routes share the same requireAuth but
 * differ in allowed roles.
 */
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../modules/auth/user.model.js';

export const requireRoles = (...allowedRoles) => {
  // Catch typos like requireRoles('Adm1n') at boot, not at request time.
  for (const role of allowedRoles) {
    if (!ROLES.includes(role)) {
      throw new Error(`requireRoles: unknown role "${role}". Valid roles: ${ROLES.join(', ')}`);
    }
  }

  return (req, res, next) => {
    if (!req.user) {
      // Programmer error: rbac ran before requireAuth. Fail loudly.
      throw new ApiError(500, 'Something went wrong. Please try again.');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }
    next();
  };
};

/**
 * Staff = every role EXCEPT the self-service personas, Worker (P2-M1) and
 * Staff (the login role — confusingly named the same as this constant, but
 * distinct: STAFF_ROLES is "company-wide admin access", the `Staff` role is
 * "self-service only"). The admin modules (employees, clients, deployments,
 * attendance, documents, quotations, dashboard) are staff-only; Worker and
 * Staff logins use the ESS portal (`/api/me`) instead, never these.
 *
 * Derived from ROLES rather than hard-coded so a future self-service role is
 * excluded automatically. Mounted at the router level (`router.use(requireStaff)`)
 * so it covers every route in a module — including the READ routes that
 * otherwise ask only for requireAuth, which is exactly where a Worker/Staff
 * login would leak into company-wide data.
 */
export const STAFF_ROLES = ROLES.filter((role) => role !== 'Worker' && role !== 'Staff');
export const requireStaff = requireRoles(...STAFF_ROLES);
