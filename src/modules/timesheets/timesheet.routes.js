/**
 * Timesheet routes (P2-M3b). requireStaffOrExecutive covers this whole
 * router, so Coordinator self-submission (P2-M4+) needed no route-gate
 * widening here — only decide/bulk-approve widen, from the original
 * Admin/Manager/HR-only rule to requireStaffOrExecutive, because the shared
 * approvalEngine is the REAL gate once a workflow governs a request (see
 * approvalEngine.service.js); the legacy (no workflow) path still enforces
 * the original rule itself. Letting Executive (GM/COO) through this
 * router-wide gate is safe the same way: they can reach /bulk-approve and
 * /monthly-report too, but the engine (and monthly-report's own inner
 * Admin-or-ApprovalRole-member check) still gates what actually happens.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireStaffOrExecutive } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  submitTimesheetSchema,
  decideTimesheetSchema,
  bulkApproveTimesheetSchema,
  listTimesheetsSchema,
  timesheetIdParamSchema,
  generateMonthlyReportSchema,
} from './timesheet.validation.js';
import * as timesheetController from './timesheet.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaffOrExecutive);

router.get('/', validate({ query: listTimesheetsSchema }), asyncHandler(timesheetController.list));
router.post('/', validate({ body: submitTimesheetSchema }), asyncHandler(timesheetController.submit));
router.patch(
  '/:id/decide',
  validate({ params: timesheetIdParamSchema, body: decideTimesheetSchema }),
  asyncHandler(timesheetController.decide)
);
router.post(
  '/bulk-approve',
  validate({ body: bulkApproveTimesheetSchema }),
  asyncHandler(timesheetController.bulkApprove)
);
// Beyond requireStaff above, the controller itself checks "Admin or a real
// Approval Role member" — see generateMonthlyReport's doc comment.
router.post(
  '/monthly-report',
  validate({ body: generateMonthlyReportSchema }),
  asyncHandler(timesheetController.generateMonthlyReport)
);

export default router;
