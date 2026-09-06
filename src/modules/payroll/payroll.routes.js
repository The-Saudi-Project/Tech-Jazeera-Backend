/**
 * Payroll routes (P2-M5). Salary data is sensitive — access is now the
 * generic, admin-configurable Section Access mechanism (see
 * sectionAccess.model.js) rather than a hardcoded requireRoles(...) list: by
 * default only Accounts (plus Admin, always) can reach this module at all,
 * with full read/write/finalize/delete as one unified circle — no more
 * separate "can view" vs "can write" vs "can finalize" tiers, since whoever
 * an Admin lets in here is meant to fully run payroll, not partially. An
 * Admin can extend that circle to specific roles or ApprovalRoles (e.g. a
 * "Financial Manager"/"COO"-named role) from the Section Access settings
 * page. Every mutation is still audit-logged regardless of who performs it
 * (see payroll.service.js's logAudit calls).
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireSectionAccess } from '../sectionAccess/sectionAccess.middleware.js';
import { validate } from '../../middleware/validate.js';
import {
  createPayrollRunSchema,
  updatePayrollLineSchema,
  listPayrollRunsSchema,
  payrollRunIdParamSchema,
  payrollLineParamSchema,
} from './payroll.validation.js';
import * as payrollController from './payroll.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireSectionAccess('payroll'));

router.get('/', validate({ query: listPayrollRunsSchema }), asyncHandler(payrollController.list));
router.get('/:id', validate({ params: payrollRunIdParamSchema }), asyncHandler(payrollController.get));
router.get(
  '/:id/lines/:lineId/pdf',
  validate({ params: payrollLineParamSchema }),
  asyncHandler(payrollController.pdf)
);
router.post('/', validate({ body: createPayrollRunSchema }), asyncHandler(payrollController.create));
router.patch(
  '/:id/lines/:lineId',
  validate({ params: payrollLineParamSchema, body: updatePayrollLineSchema }),
  asyncHandler(payrollController.updateLine)
);
router.patch(
  '/:id/finalize',
  validate({ params: payrollRunIdParamSchema }),
  asyncHandler(payrollController.finalize)
);
router.delete('/:id', validate({ params: payrollRunIdParamSchema }), asyncHandler(payrollController.remove));

export default router;
