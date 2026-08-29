/**
 * Zod schemas for Exit Re-Entry visa requests.
 */
import { z } from 'zod';
import { VISA_TYPES, EXIT_REENTRY_STATUSES } from './exitReentry.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const submitExitReentrySchema = z
  .object({
    visaType: z.enum(VISA_TYPES, { error: 'Choose a visa type.' }),
    departureDate: z.coerce.date({ error: 'Departure date is required.' }),
    expectedReturnDate: z.coerce.date({ error: 'Expected return date is required.' }),
    linkedLeaveRequest: z.preprocess(emptyToUndef, id.optional()),
    reason: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
  })
  .refine((data) => data.expectedReturnDate >= data.departureDate, {
    message: 'Return date cannot be before the departure date.',
    path: ['expectedReturnDate'],
  });

export const decideExitReentrySchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
  decisionNote: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const markIssuedSchema = z.object({
  visaReferenceNumber: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
});

export const listExitReentrySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(EXIT_REENTRY_STATUSES).optional()),
  employee: z.preprocess(emptyToUndef, id.optional()),
});

export const listMyExitReentrySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(EXIT_REENTRY_STATUSES).optional()),
});

export const exitReentryIdParamSchema = z.object({ id });
