/**
 * Zod schemas for the Approvals module: ApprovalRole and ApprovalWorkflow
 * configuration (Admin-only — see approvals.routes.js).
 */
import { z } from 'zod';
import { APPROVAL_REQUEST_TYPES } from './approvalWorkflow.model.js';

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const objectId = (label) => z.string().regex(/^[a-f0-9]{24}$/i, `Invalid ${label} id.`);

export const createApprovalRoleSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(60),
  description: z.preprocess(emptyToUndef, z.string().trim().max(300).optional()),
  members: z.array(objectId('user')).default([]),
  isActive: z.boolean().default(true),
});

export const updateApprovalRoleSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.preprocess(emptyToUndef, z.string().trim().max(300).optional()),
  members: z.array(objectId('user')).optional(),
  isActive: z.boolean().optional(),
});

export const approvalRoleIdParamSchema = z.object({ id: objectId('approval role') });

const workflowStepSchema = z.object({
  label: z.preprocess(emptyToUndef, z.string().trim().max(60).optional()),
  roles: z.array(objectId('approval role')).min(1, 'Each step needs at least one role.'),
});

export const createApprovalWorkflowSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(60),
  steps: z.array(workflowStepSchema).min(1, 'A workflow needs at least one step.'),
  appliesTo: z.array(z.enum(APPROVAL_REQUEST_TYPES)).default([]),
  isActive: z.boolean().default(true),
});

export const updateApprovalWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  steps: z.array(workflowStepSchema).min(1).optional(),
  appliesTo: z.array(z.enum(APPROVAL_REQUEST_TYPES)).optional(),
  isActive: z.boolean().optional(),
});

export const approvalWorkflowIdParamSchema = z.object({ id: objectId('approval workflow') });

export const approvalLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.preprocess(emptyToUndef, z.enum(APPROVAL_REQUEST_TYPES).optional()),
  status: z.preprocess(emptyToUndef, z.enum(['PendingReview', 'Approved', 'Rejected']).optional()),
  employee: z.preprocess(emptyToUndef, objectId('employee').optional()),
  from: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndef, z.coerce.date().optional()),
});
