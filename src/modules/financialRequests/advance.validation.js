/**
 * Zod schemas for salary advance endpoints.
 */
import { z } from 'zod';
import { ADVANCE_STATUSES } from './advance.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const submitAdvanceSchema = z.object({
  amount: z.coerce.number({ error: 'Amount is required.' }).min(1).max(1_000_000),
  reason: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
  repaymentMonths: z.coerce.number().int().min(1).max(24).default(1),
});

export const decideAdvanceSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
  decisionNote: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const addRepaymentSchema = z.object({
  amount: z.coerce.number({ error: 'Amount is required.' }).min(0.01),
  date: z.coerce.date({ error: 'Date is required.' }),
  note: z.preprocess(emptyToUndef, z.string().trim().max(200).optional()),
});

export const listAdvancesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(ADVANCE_STATUSES).optional()),
  employee: z.preprocess(emptyToUndef, id.optional()),
});

export const listMyAdvancesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(ADVANCE_STATUSES).optional()),
});

export const advanceIdParamSchema = z.object({ id });
