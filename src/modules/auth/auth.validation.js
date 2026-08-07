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
