/**
 * Zod schemas for the Holiday module.
 */
import { z } from 'zod';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);

export const createHolidaySchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required.').max(120),
    startDate: z.coerce.date({ error: 'Start date is required.' }),
    endDate: z.coerce.date({ error: 'End date is required.' }),
    isPaid: z.boolean().default(true),
    notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before the start date.',
    path: ['endDate'],
  });

/** PATCH: any subset — the service re-checks endDate >= startDate against the merged record. */
export const updateHolidaySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isPaid: z.boolean().optional(),
  notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const listHolidaysSchema = z.object({
  from: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndef, z.coerce.date().optional()),
});

export const holidayIdParamSchema = z.object({ id: objectId('holiday') });
