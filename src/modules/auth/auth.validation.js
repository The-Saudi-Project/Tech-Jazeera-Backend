/**
 * Zod schemas for auth endpoints. Transforms here double as sanitization:
 * controllers receive trimmed, lowercased, unknown-keys-stripped input.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
  // Just "not empty" — real strength rules apply when SETTING passwords
  // (seed script), not when checking them. Cap prevents 10MB bcrypt DoS.
  password: z.string().min(1, 'Password is required.').max(128),
});

/** Same 8-char minimum as seed-admin.js — one policy, not two. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.').max(128),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
});
