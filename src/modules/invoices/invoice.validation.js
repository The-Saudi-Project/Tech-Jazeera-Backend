/**
 * Zod schemas for invoice endpoints. Note: money TOTALS are never accepted
 * from the client — they are computed server-side from the source
 * quotation's line items — so they are absent here, same as quotations.
 */
import { z } from 'zod';
import { INVOICE_STATUSES } from './invoice.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const createInvoiceSchema = z.object({
  quotation: id,
  dueDate: z.preprocess(emptyToUndef, z.coerce.date().optional()),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number({ error: 'Amount is required.' }).min(0.01),
  date: z.coerce.date({ error: 'Date is required.' }),
  method: z.preprocess(emptyToUndef, z.string().trim().max(50).optional()),
  reference: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  client: id.optional(),
  quotation: id.optional(),
  status: z.preprocess(emptyToUndef, z.enum(INVOICE_STATUSES).optional()),
  search: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
});

export const invoiceIdParamSchema = z.object({ id });
