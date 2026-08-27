/**
 * Zod schema for the Admin/Manager/HR oversight view — everyone's staff
 * self-attendance over a date range. The self-service endpoints (punch, own
 * history) reuse attendance.validation.js's selfMarkSchema/
 * listMyAttendanceSchema directly since the shapes are identical.
 */
import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');

export const listAllStaffAttendanceSchema = z.object({
  from: dateOnly,
  to: dateOnly,
});
