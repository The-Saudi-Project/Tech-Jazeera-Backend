/**
 * Zod schemas for staff-account management (P2-M2).
 *
 * This module manages EXISTING staff logins only (Admin, Manager, HR,
 * Accounts, Coordinator). Creating a login — staff or Worker alike — is
 * always POST /api/employees/:id/user, because a login is meaningless
 * without the Employee it's linked to.
 */
import { z } from 'zod';
import { ROLES } from '../auth/user.model.js';

const emptyToUndef = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Every role except Worker — the set this module is allowed to assign. */
export const STAFF_ASSIGNABLE_ROLES = ROLES.filter((role) => role !== 'Worker');

const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);

export const updateStaffUserSchema = z.object({
  role: z.enum(STAFF_ASSIGNABLE_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const listStaffUsersSchema = z.object({
  role: z.preprocess(emptyToUndef, z.enum(ROLES).optional()),
});

export const userIdParamSchema = z.object({
  id: objectId('user'),
});
