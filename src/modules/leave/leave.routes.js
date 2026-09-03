/**
 * Leave routes (P2-M2).
 *
 * Two resources share this module: LeaveType (policy config) and LeaveRequest
 * (the staff review queue). Workers submit/view/cancel their OWN requests
 * through /api/me/leave instead (see the `me` module) — this router is the
 * staff-facing half, plus the read-only leave-types list every authenticated
 * user (including Worker) needs to populate a submission form.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  listLeaveTypesSchema,
  leaveTypeIdParamSchema,
  listLeaveRequestsSchema,
  submitLeaveRequestSchema,
  decideLeaveRequestSchema,
  leaveRequestIdParamSchema,
} from './leave.validation.js';
import * as leaveController from './leave.controller.js';

const router = Router();

router.use(requireAuth);

// Leave types: readable by anyone authenticated (a Worker needs this list to
// submit); only Admin/Manager shape the policy.
router.get(
  '/leave-types',
  validate({ query: listLeaveTypesSchema }),
  asyncHandler(leaveController.listTypes)
);
router.post(
  '/leave-types',
  requireRoles('Admin', 'Manager'),
  validate({ body: createLeaveTypeSchema }),
  asyncHandler(leaveController.createType)
);
router.patch(
  '/leave-types/:id',
  requireRoles('Admin', 'Manager'),
  validate({ params: leaveTypeIdParamSchema, body: updateLeaveTypeSchema }),
  asyncHandler(leaveController.updateType)
);

// Leave requests: the staff review queue. Workers use /api/me/leave.
router.get(
  '/leave',
  requireStaff,
  validate({ query: listLeaveRequestsSchema }),
  asyncHandler(leaveController.list)
);
// A staff member submitting their OWN leave request (Coordinator/HR/Manager/
// Accounts) — the self-submission gap the Approval Hierarchy work filled.
// Admin has no Employee record and gets a clear 400 from the controller.
router.post(
  '/leave',
  requireStaff,
  validate({ body: submitLeaveRequestSchema }),
  asyncHandler(leaveController.submit)
);
// requireStaff (not the original 4-role list): once ApprovalRole membership
// is decoupled from User.role, an Admin could legitimately put an Accounts
// user into a workflow step — the shared engine (approvalEngine.service.js)
// is the REAL authorization now; this just confirms "some staff member is
// asking." A request not yet on a workflow still enforces the original
// Admin/Manager/HR/Coordinator gate itself, inside the engine's legacy path.
router.patch(
  '/leave/:id/decide',
  requireStaff,
  validate({ params: leaveRequestIdParamSchema, body: decideLeaveRequestSchema }),
  asyncHandler(leaveController.decide)
);
router.patch(
  '/leave/:id/acknowledge',
  requireRoles('Admin', 'Manager', 'HR', 'Coordinator'),
  validate({ params: leaveRequestIdParamSchema }),
  asyncHandler(leaveController.acknowledge)
);

export default router;
