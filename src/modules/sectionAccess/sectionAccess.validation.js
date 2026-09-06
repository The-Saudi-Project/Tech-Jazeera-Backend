/**
 * Zod schemas for Section Access. `allowedRoles` is validated against
 * GRANTABLE_ROLES (every User.role except Worker/Staff) — the same floor
 * requireSectionAccess enforces at request time, kept in one place.
 */
import { z } from 'zod';
import { SECTION_KEYS, GRANTABLE_ROLES } from './sectionAccess.model.js';

const approvalRoleId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid role id.');

export const sectionKeyParamSchema = z.object({
  sectionKey: z.enum(SECTION_KEYS),
});

export const updateSectionAccessSchema = z.object({
  allowedRoles: z.array(z.enum(GRANTABLE_ROLES)).max(GRANTABLE_ROLES.length),
  allowedApprovalRoles: z.array(approvalRoleId).max(50),
});
