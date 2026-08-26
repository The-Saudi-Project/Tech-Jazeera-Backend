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

/** P2-M3: a Worker's self check-in/check-out (same shape for both). lat/lng
 *  are optional so an office-IP-only check still works if the browser denied
 *  location access. */
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

/** A physical NFC tap point's token — base64url, matches generateTapToken(). */
const tapToken = z.string().regex(/^[A-Za-z0-9_-]{10,24}$/, 'Invalid tap token.');

/** A Worker tapping a physical tag — same location fields as selfMarkSchema,
 *  plus which tap point. */
export const tapSchema = z.object({
  token: tapToken,
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracy: z.coerce.number().min(0).optional(),
});

/** Admin CRUD for tap points (rooms). Direction is fixed per point — see
 *  tapPoint.model.js for why it isn't inferred from the worker's state. */
export const createTapPointSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(60),
  direction: z.enum(['in', 'out'], { error: 'Direction must be "in" or "out".' }),
});
export const updateTapPointSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  direction: z.enum(['in', 'out']).optional(),
  active: z.coerce.boolean().optional(),
});
export const tapPointIdParamSchema = z.object({ id });
