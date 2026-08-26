/**
 * Zod schemas for employee endpoints — the write gate for all employee data.
 *
 * HTML forms send "" for every untouched field; the `emptyToUndef`
 * preprocessor turns those into undefined so optional fields stay truly
 * absent instead of storing empty strings.
 */
import { z } from 'zod';
import { EMPLOYEE_STATUSES } from './employee.model.js';

const emptyToUndef = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalStr = (max) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const optionalDate = z.preprocess(emptyToUndef, z.coerce.date().optional());

/** Like an objectId field, but "" means "unassign" (null), not "untouched". */
const nullableObjectId = (label) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`).nullable().optional()
  );

/** Like nullableObjectId, but for a number — "" means "clear it" (null). */
const nullableHours = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.coerce.number({ error: 'Enter a number of hours.' }).min(0).max(24).nullable().optional()
);

// Loose international phone shape — real-world numbers are messy; we only
// reject obvious garbage, we don't try to fully parse them.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,18}$/, 'Enter a valid phone number.');

/** One identity document: number + expiry, both optional (e.g. no iqama yet). */
const documentSchema = z
  .object({
    number: optionalStr(50),
    expiry: optionalDate,
  })
  .optional();

export const createEmployeeSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Only letters, numbers and dashes.')
    .transform((s) => s.toUpperCase()),
  fullName: z.string().trim().min(2, 'Full name is required.').max(100),
  nationality: z.string().trim().min(2, 'Nationality is required.').max(60),
  mobile: phone,
  email: z.preprocess(
    (v) => (typeof v === 'string' ? emptyToUndef(v.trim().toLowerCase()) : v),
    z.email('Enter a valid email address.').optional()
  ),

  passport: documentSchema,
  visa: documentSchema,
  iqama: documentSchema,
  medical: documentSchema,
  drivingLicense: documentSchema,

  joiningDate: z.coerce.date({ error: 'Joining date is required.' }),
  designation: z.string().trim().min(2, 'Designation is required.').max(60),
  department: optionalStr(60),
  salary: z.coerce.number({ error: 'Salary must be a number.' }).min(0).max(1_000_000),
  accommodation: optionalStr(100),
  // Early-sign-out warning threshold for this employee (My Attendance). "" means
  // "no threshold" (null), not "leave unchanged" — same rule as coordinator.
  expectedDailyHours: nullableHours,
  status: z.enum(EMPLOYEE_STATUSES).default('Active'),

  emergencyContact: z
    .object({
      name: optionalStr(100),
      phone: z.preprocess(emptyToUndef, phone.optional()),
      relation: optionalStr(50),
    })
    .optional(),
  notes: optionalStr(2000),
  // P2-M2: the Coordinator responsible for this employee. Admin/Manager/HR
  // assign it (same write circle as the rest of the record); referential
  // integrity (must be a real 'Coordinator' user) is checked in the service.
  coordinator: nullableObjectId('coordinator'),
  // NOTE: currentClient / currentSite are deliberately absent — they are set
  // by the deployment workflow (M6), and unknown keys are stripped by Zod,
  // so a hand-crafted request can't smuggle an assignment through this form.
});

/** PATCH: any subset of the same fields, same rules. */
export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: optionalStr(100),
  status: z.preprocess(emptyToUndef, z.enum(EMPLOYEE_STATUSES).optional()),
  // String enum, NOT z.coerce.boolean() — that coerces the string "false" to
  // true (any non-empty string is truthy), a classic query-string trap.
  alerts: z.preprocess(emptyToUndef, z.enum(['true', 'false']).optional()),
  // Filter to one client's workforce — powers the client profile's
  // "Assigned Workers" tab (M5). Set by the deployment workflow (M6).
  client: z.preprocess(
    emptyToUndef,
    z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid client id.').optional()
  ),
  // 'true' → only workers with no current client (assignable). Powers the
  // deployment assign form's worker picker (M6).
  unassigned: z.preprocess(emptyToUndef, z.enum(['true', 'false']).optional()),
  // P2-M2: a Manager passes 'mine' to see only their coordinators' employees.
  // A Coordinator is scoped to their own team automatically — no param needed.
  team: z.preprocess(emptyToUndef, z.enum(['mine']).optional()),
  // 'Coordinator' → only employees created by a Coordinator account. Powers
  // the Coordinator Activity page.
  createdByRole: z.preprocess(emptyToUndef, z.enum(['Coordinator']).optional()),
  // P2-M2: override the default 30-day expiry-alert window (customizable per
  // viewer — see docs/P2-M2-notes.md). Only meaningful together with alerts=true.
  thresholdDays: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(365).optional()),
  sortBy: z.enum(['fullName', 'joiningDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const employeeIdParamSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid employee id.'),
});

/**
 * Body for provisioning a Worker login (P2-M1). `email` is optional: the
 * service defaults to the employee's own email and only needs this when the
 * record has none. Same preprocess as the employee email so "" → undefined.
 */
export const createLoginSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? emptyToUndef(v.trim().toLowerCase()) : v),
    z.email('Enter a valid email address.').optional()
  ),
});
