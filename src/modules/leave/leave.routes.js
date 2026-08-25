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
router.patch(
  '/leave/:id/decide',
  requireRoles('Admin', 'Manager', 'HR', 'Coordinator'),
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
