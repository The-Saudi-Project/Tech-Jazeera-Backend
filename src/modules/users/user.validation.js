/**
 * Zod schemas for staff-account management (P2-M2).
 *
 * This module provisions STAFF logins only (Admin, Manager, HR, Accounts,
 * Coordinator). Worker logins stay on their existing path —
 * POST /api/employees/:id/user — because a Worker login is meaningless
 * without the Employee it's linked to; a staff login has no such anchor.
 */
import { z } from 'zod';
import { ROLES } from '../auth/user.model.js';

const emptyToUndef = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Every role except Worker — the set this module is allowed to assign. */
export const STAFF_ASSIGNABLE_ROLES = ROLES.filter((role) => role !== 'Worker');

const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(100),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email('Enter a valid email address.')
  ),
  role: z.enum(STAFF_ASSIGNABLE_ROLES, {
    error: `Role must be one of: ${STAFF_ASSIGNABLE_ROLES.join(', ')}.`,
  }),
  // Only meaningful when role === 'Coordinator'; ignored otherwise (service
  // enforces that, since the correct cross-field rule isn't expressible here).
  managedBy: z.preprocess(emptyToUndef, objectId('manager').optional()),
});

export const updateStaffUserSchema = z.object({
  role: z.enum(STAFF_ASSIGNABLE_ROLES).optional(),
  managedBy: z.preprocess(emptyToUndef, objectId('manager').nullable().optional()),
  isActive: z.boolean().optional(),
});

export const listStaffUsersSchema = z.object({
  role: z.preprocess(emptyToUndef, z.enum(ROLES).optional()),
});

export const userIdParamSchema = z.object({
  id: objectId('user'),
});
