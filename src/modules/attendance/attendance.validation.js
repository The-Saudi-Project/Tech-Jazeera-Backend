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

/** P2-M3: the office geofence Admin configures. */
export const officeLocationSchema = z.object({
  name: optionalNote,
  lat: z.coerce.number({ error: 'Latitude is required.' }).min(-90).max(90),
  lng: z.coerce.number({ error: 'Longitude is required.' }).min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(10).max(5000).default(150),
  allowedIps: z.array(z.string().trim().min(3).max(45)).max(10).default([]),
});

/** P2-M3: a Worker's self-mark. lat/lng are optional so an office-IP-only
 *  check still works if the browser denied location access. */
export const selfMarkSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracy: z.coerce.number().min(0).optional(),
});

/** A Worker's own attendance history — range is optional (service defaults it). */
export const listMyAttendanceSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});
