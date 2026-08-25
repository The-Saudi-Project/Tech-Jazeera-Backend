/**
 * Zod schemas for the Leave module: LeaveType configuration (Admin/Manager)
 * and LeaveRequest submission/review.
 */
import { z } from 'zod';
import { LEAVE_RECURRENCES } from './leaveType.model.js';
import { LEAVE_REQUEST_STATUSES } from './leaveRequest.model.js';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);
const optionalDays = z.preprocess(emptyToUndef, z.coerce.number().min(0).max(365).optional());
const optionalYears = (max) => z.preprocess(emptyToUndef, z.coerce.number().min(1).max(max).optional());

export const createLeaveTypeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required.').max(60),
    recurrence: z.enum(LEAVE_RECURRENCES, { error: 'Choose how this leave is earned.' }),
    daysPerYear: optionalDays,
    tierYears: optionalYears(50),
    tierDaysPerYear: optionalDays,
    cycleYears: optionalYears(20),
    daysPerCycle: optionalDays,
    minServiceMonths: z.coerce.number().min(0).max(600).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence === 'Annual' && data.daysPerYear === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['daysPerYear'],
        message: 'Days per year is required for an Annual leave type.',
      });
    }
    if (data.recurrence === 'ContractCycle' && (data.cycleYears === undefined || data.daysPerCycle === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cycleYears'],
        message: 'Cycle length and days per cycle are required for a Contract-cycle leave type.',
      });
    }
    if ((data.tierYears !== undefined) !== (data.tierDaysPerYear !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['tierYears'],
        message: 'Tier years and tier days must be set together.',
      });
    }
  });

/** PATCH: any subset, same field rules, no cross-field re-check (partial edits are common). */
export const updateLeaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  recurrence: z.enum(LEAVE_RECURRENCES).optional(),
  daysPerYear: optionalDays,
  tierYears: optionalYears(50),
  tierDaysPerYear: optionalDays,
  cycleYears: optionalYears(20),
  daysPerCycle: optionalDays,
  minServiceMonths: z.coerce.number().min(0).max(600).optional(),
  isActive: z.boolean().optional(),
});

export const listLeaveTypesSchema = z.object({
  activeOnly: z.preprocess(emptyToUndef, z.enum(['true', 'false']).optional()),
});

export const leaveTypeIdParamSchema = z.object({ id: objectId('leave type') });

export const submitLeaveRequestSchema = z.object({
  leaveType: objectId('leave type'),
  startDate: z.coerce.date({ error: 'Start date is required.' }),
  endDate: z.coerce.date({ error: 'End date is required.' }),
  reason: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const decideLeaveRequestSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Decision must be Approved or Rejected.' }),
  decisionNote: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export const listLeaveRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(LEAVE_REQUEST_STATUSES).optional()),
  employee: z.preprocess(emptyToUndef, objectId('employee').optional()),
});

export const listMyLeaveRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndef, z.enum(LEAVE_REQUEST_STATUSES).optional()),
});

export const leaveRequestIdParamSchema = z.object({ id: objectId('leave request') });
