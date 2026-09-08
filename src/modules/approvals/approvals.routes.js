/**
 * Approvals routes. WRITE (create/edit roles and workflows) is Section
 * Access key 'approvalHierarchy', default [] — matches today's Admin-only
 * behavior exactly until an Admin grants someone else. READ (list) stays
 * requireStaff, untouched: EmployeeForm's approval-workflow override picker
 * (Manager/HR/Coordinator, not just Admin) and every request-decide
 * screen's trail display need role/workflow NAMES, which carry no
 * sensitive data — same asymmetric-read pattern as LeaveType (anyone
 * authenticated reads, only the grant circle writes). Deciding a step
 * happens on each request module's own decide route (leave.routes.js etc.),
 * via the shared approvalEngine — this router owns configuration only. The
 * Approval Log (`/log`) is untouched — already dynamically gated (Admin, or
 * a real ApprovalRole member) inside the controller itself.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireStaff, requireStaffOrExecutive } from '../../middleware/rbac.js';
import { requireSectionAccess } from '../sectionAccess/sectionAccess.middleware.js';
import { validate } from '../../middleware/validate.js';
import {
  createApprovalRoleSchema,
  updateApprovalRoleSchema,
  approvalRoleIdParamSchema,
  createApprovalWorkflowSchema,
  updateApprovalWorkflowSchema,
  approvalWorkflowIdParamSchema,
  approvalLogQuerySchema,
} from './approvals.validation.js';
import * as approvalsController from './approvals.controller.js';

const router = Router();

router.use(requireAuth);

const canManageApprovalHierarchy = requireSectionAccess('approvalHierarchy');

router.get('/roles', requireStaff, asyncHandler(approvalsController.listRoles));
router.post(
  '/roles',
  canManageApprovalHierarchy,
  validate({ body: createApprovalRoleSchema }),
  asyncHandler(approvalsController.createRole)
);
router.patch(
  '/roles/:id',
  canManageApprovalHierarchy,
  validate({ params: approvalRoleIdParamSchema, body: updateApprovalRoleSchema }),
  asyncHandler(approvalsController.updateRole)
);

router.get('/workflows', requireStaff, asyncHandler(approvalsController.listWorkflows));
router.post(
  '/workflows',
  canManageApprovalHierarchy,
  validate({ body: createApprovalWorkflowSchema }),
  asyncHandler(approvalsController.createWorkflow)
);
router.patch(
  '/workflows/:id',
  canManageApprovalHierarchy,
  validate({ params: approvalWorkflowIdParamSchema, body: updateApprovalWorkflowSchema }),
  asyncHandler(approvalsController.updateWorkflow)
);

// Open to any staff member (or Executive) — the controller applies the
// real, dynamic "Admin or an actual ApprovalRole member" gate itself.
router.get('/log', requireStaffOrExecutive, validate({ query: approvalLogQuerySchema }), asyncHandler(approvalsController.log));

export default router;
