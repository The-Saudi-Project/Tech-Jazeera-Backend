/**
 * Zod schemas for the RamadanPeriod module — mirrors holiday.validation.js
 * exactly, plus the two configurable hour caps.
 */
import { z } from 'zod';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);

export const createRamadanPeriodSchema = z
  .object({
    label: z.string().trim().min(2, 'Label is required.').max(120),
    startDate: z.coerce.date({ error: 'Start date is required.' }),
    endDate: z.coerce.date({ error: 'End date is required.' }),
    dailyHours: z.coerce.number().min(1).max(8).default(6),
    weeklyHours: z.coerce.number().min(6).max(48).default(36),
    notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before the start date.',
    path: ['endDate'],
  });

/** PATCH: any subset — the service re-checks endDate >= startDate against the merged record. */
export const updateRamadanPeriodSchema = z.object({
  label: z.string().trim().min(2).max(120).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  dailyHours: z.coerce.number().min(1).max(8).optional(),
  weeklyHours: z.coerce.number().min(6).max(48).optional(),
  notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const listRamadanPeriodsSchema = z.object({
  from: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndef, z.coerce.date().optional()),
});

export const ramadanPeriodIdParamSchema = z.object({ id: objectId('Ramadan period') });
