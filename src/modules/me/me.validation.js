/**
 * Zod schemas for the "me" (ESS) module's own routes — everything else on
 * this router reuses another module's validation (leave, attendance, ...)
 * since those actions ARE that module's business logic, just self-scoped.
 * Self-edit is different: there's no admin equivalent to reuse, and reusing
 * employee.validation.js's full updateEmployeeSchema would hand a Worker a
 * schema that also accepts salary/type/coordinator/etc — so this is its own,
 * deliberately narrow schema instead.
 */
import { z } from 'zod';

const emptyToUndef = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalStr = (max) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

// Same loose international phone shape as employee.validation.js.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,18}$/, 'Enter a valid phone number.');

/**
 * Self-edit for an 'Own'-type Worker/Staff login (Milestone 4) — contact-info
 * fields only (mobile/email/accommodation/emergencyContact), the exact set
 * agreed with the user. Mirrors employee.validation.js's own field-level
 * rules for these same fields, so a value valid here is valid there too.
 */
export const updateMyProfileSchema = z.object({
  mobile: z.preprocess(emptyToUndef, phone.optional()),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? emptyToUndef(v.trim().toLowerCase()) : v),
    z.email('Enter a valid email address.').optional()
  ),
  accommodation: optionalStr(100),
  emergencyContact: z
    .object({
      name: optionalStr(100),
      phone: z.preprocess(emptyToUndef, phone.optional()),
      relation: optionalStr(50),
    })
    .optional(),
});
