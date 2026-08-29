/**
 * Zod schemas for reimbursement-claim endpoints. The submit schema validates
 * the multipart TEXT fields only — the receipt file itself is handled by
 * the upload middleware and checked for presence in the service layer,
 * exactly like Document's createDocumentSchema.
 */
import { z } from 'zod';
import { REIMBURSEMENT_CATEGORIES, REIMBURSEMENT_STATUSES } from './reimbursement.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const submitReimbursementSchema = z.object({
  category: z.enum(REIMBURSEMENT_CATEGORIES, { error: 'Choose an expense category.' }),
  amount: z.coerce.number({ error: 'Amount is required.' }).min(0.01).max(1_000_000),
  expenseDate: z.coerce.date({ error: 'Expense date is required.' }),
  description: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const decideReimbursementSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
  decisionNote: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const listReimbursementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(REIMBURSEMENT_STATUSES).optional()),
  employee: z.preprocess(emptyToUndef, id.optional()),
});

export const listMyReimbursementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(REIMBURSEMENT_STATUSES).optional()),
});

export const reimbursementIdParamSchema = z.object({ id });
