/**
 * Timesheet routes (P2-M3b). Roles mirror Attendance's own write guard
 * (Admin/Manager/HR) — deciding a timesheet is the same supervisory circle
 * as correcting an attendance day.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  decideTimesheetSchema,
  bulkApproveTimesheetSchema,
  listTimesheetsSchema,
  timesheetIdParamSchema,
} from './timesheet.validation.js';
import * as timesheetController from './timesheet.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff);

const canDecide = requireRoles('Admin', 'Manager', 'HR');

router.get('/', validate({ query: listTimesheetsSchema }), asyncHandler(timesheetController.list));
router.patch(
  '/:id/decide',
  canDecide,
  validate({ params: timesheetIdParamSchema, body: decideTimesheetSchema }),
  asyncHandler(timesheetController.decide)
);
router.post(
  '/bulk-approve',
  canDecide,
  validate({ body: bulkApproveTimesheetSchema }),
  asyncHandler(timesheetController.bulkApprove)
);

export default router;
