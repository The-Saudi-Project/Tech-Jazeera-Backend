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
import { requireRoles, requireStaff, requireStaffOrExecutive } from '../../middleware/rbac.js';
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
// submit); only Admin/HR shape the policy — this is company leave policy
// configuration, not a day-to-day operational manager's job.
router.get(
  '/leave-types',
  validate({ query: listLeaveTypesSchema }),
  asyncHandler(leaveController.listTypes)
);
router.post(
  '/leave-types',
  requireRoles('Admin', 'HR'),
  validate({ body: createLeaveTypeSchema }),
  asyncHandler(leaveController.createType)
);
router.patch(
  '/leave-types/:id',
  requireRoles('Admin', 'HR'),
  validate({ params: leaveTypeIdParamSchema, body: updateLeaveTypeSchema }),
  asyncHandler(leaveController.updateType)
);

// Leave requests: the staff review queue. Workers use /api/me/leave.
// requireStaffOrExecutive on these three: an Executive (GM/COO) needs to see
// the queue, submit their own request, and decide whatever step they're a
// real ApprovalRole member of — the engine re-checks that membership itself.
router.get(
  '/leave',
  requireStaffOrExecutive,
  validate({ query: listLeaveRequestsSchema }),
  asyncHandler(leaveController.list)
);
// A staff member submitting their OWN leave request (Coordinator/HR/Manager/
// Accounts) — the self-submission gap the Approval Hierarchy work filled.
// Admin has no Employee record and gets a clear 400 from the controller.
router.post(
  '/leave',
  requireStaffOrExecutive,
  validate({ body: submitLeaveRequestSchema }),
  asyncHandler(leaveController.submit)
);
// requireStaffOrExecutive (not the original 4-role list): once ApprovalRole
// membership is decoupled from User.role, an Admin could legitimately put an
// Accounts user into a workflow step — the shared engine
// (approvalEngine.service.js) is the REAL authorization now; this just
// confirms "some staff member (or Executive) is asking." A request not yet
// on a workflow still enforces the original Admin/Manager/HR/Coordinator
// gate itself, inside the engine's legacy path — an Executive with no
// workflow membership can reach this route but can't decide anything on it.
router.patch(
  '/leave/:id/decide',
  requireStaffOrExecutive,
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
