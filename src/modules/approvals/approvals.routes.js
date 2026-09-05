/**
 * Approvals routes. WRITE (create/edit roles and workflows) is Admin-only —
 * the self-service hierarchy the company asked to define on their own.
 * READ (list) is open to any staff member: EmployeeForm's approval-workflow
 * override picker (Manager/HR/Coordinator, not just Admin) and every
 * request-decide screen's trail display need role/workflow NAMES, which
 * carry no sensitive data — same asymmetric-read pattern as LeaveType
 * (anyone authenticated reads, only Admin/Manager writes). Deciding a step
 * happens on each request module's own decide route (leave.routes.js etc.),
 * via the shared approvalEngine — this router owns configuration only.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff, requireStaffOrExecutive } from '../../middleware/rbac.js';
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

router.get('/roles', requireStaff, asyncHandler(approvalsController.listRoles));
router.post(
  '/roles',
  requireRoles('Admin'),
  validate({ body: createApprovalRoleSchema }),
  asyncHandler(approvalsController.createRole)
);
router.patch(
  '/roles/:id',
  requireRoles('Admin'),
  validate({ params: approvalRoleIdParamSchema, body: updateApprovalRoleSchema }),
  asyncHandler(approvalsController.updateRole)
);

router.get('/workflows', requireStaff, asyncHandler(approvalsController.listWorkflows));
router.post(
  '/workflows',
  requireRoles('Admin'),
  validate({ body: createApprovalWorkflowSchema }),
  asyncHandler(approvalsController.createWorkflow)
);
router.patch(
  '/workflows/:id',
  requireRoles('Admin'),
  validate({ params: approvalWorkflowIdParamSchema, body: updateApprovalWorkflowSchema }),
  asyncHandler(approvalsController.updateWorkflow)
);

// Open to any staff member (or Executive) — the controller applies the
// real, dynamic "Admin or an actual ApprovalRole member" gate itself.
router.get('/log', requireStaffOrExecutive, validate({ query: approvalLogQuerySchema }), asyncHandler(approvalsController.log));

export default router;
