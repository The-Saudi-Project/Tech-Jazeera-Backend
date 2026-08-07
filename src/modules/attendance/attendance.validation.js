/**
 * Zod schemas for attendance endpoints. Dates are validated as `YYYY-MM-DD`
 * strings; the service converts them to UTC-midnight Dates.
 */
import { z } from 'zod';
import { ATTENDANCE_STATUSES } from './attendance.model.js';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');
const optionalNote = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(300).optional()
);

/** Mark many workers for a single day (the daily-marking action). */
export const markBulkSchema = z.object({
  date: dateOnly,
  records: z
    .array(
      z.object({
        employee: id,
        status: z.enum(ATTENDANCE_STATUSES),
        note: optionalNote,
      })
    )
    .min(1, 'Nothing to save — mark at least one worker.')
    .max(500),
});

/** A date range is required so we never scan the whole collection. */
const rangeShape = {
  from: dateOnly,
  to: dateOnly,
  employee: id.optional(),
};

export const listAttendanceSchema = z.object(rangeShape);
export const summarySchema = z.object(rangeShape);
export const exportSchema = z.object({
  format: z.enum(['xlsx', 'pdf']),
  from: dateOnly,
  to: dateOnly,
});
