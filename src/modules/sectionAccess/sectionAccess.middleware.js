/**
 * requireSectionAccess — the dynamic counterpart to requireRoles(...) for a
 * module whose access circle an Admin configures at runtime (see
 * sectionAccess.model.js). The Worker/Staff floor and the Admin override
 * both live in canAccessSection itself, shared with the "mine" endpoint —
 * this middleware is just the route gate around that one check.
 */
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { canAccessSection } from './sectionAccess.service.js';

export function requireSectionAccess(sectionKey) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      // Programmer error: this ran before requireAuth. Fail loudly.
      throw new ApiError(500, 'Something went wrong. Please try again.');
    }
    const allowed = await canAccessSection(sectionKey, { userId: req.user.id, role: req.user.role });
    if (!allowed) {
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }
    next();
  });
}
