/**
 * Zod schemas for the Timesheet module.
 */
import { z } from 'zod';
import { TIMESHEET_STATUSES } from './timesheet.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const submitTimesheetSchema = z.object({
  // Any date within the target week — the service resolves it to that
  // week's Saturday..Friday bounds.
  periodStart: z.coerce.date({ error: 'Choose the week to submit.' }),
  notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const decideTimesheetSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
  decisionNote: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const bulkApproveTimesheetSchema = z.object({
  ids: z.array(id).min(1, 'Select at least one timesheet.').max(200),
});

export const listTimesheetsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(TIMESHEET_STATUSES).optional()),
  employee: z.preprocess(emptyToUndef, id.optional()),
});

export const listMyTimesheetsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const timesheetIdParamSchema = z.object({ id });
