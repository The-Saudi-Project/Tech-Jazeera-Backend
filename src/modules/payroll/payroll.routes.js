/**
 * Payroll routes (P2-M5). Salary data is sensitive: read is Admin/Manager/
 * HR/Accounts (not Coordinator); building a run and editing a Draft line is
 * Admin/Manager/Accounts (mirrors Quotation's write circle — a financial
 * document); finalizing or deleting a run is Admin/Manager only, the same
 * heavier circle that deletes a quotation.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
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
router.use(requireRoles('Admin', 'Manager', 'HR', 'Accounts'));

const canWrite = requireRoles('Admin', 'Manager', 'Accounts');
const canFinalize = requireRoles('Admin', 'Manager');

router.get('/', validate({ query: listPayrollRunsSchema }), asyncHandler(payrollController.list));
router.get('/:id', validate({ params: payrollRunIdParamSchema }), asyncHandler(payrollController.get));
router.get(
  '/:id/lines/:lineId/pdf',
  validate({ params: payrollLineParamSchema }),
  asyncHandler(payrollController.pdf)
);
router.post('/', canWrite, validate({ body: createPayrollRunSchema }), asyncHandler(payrollController.create));
router.patch(
  '/:id/lines/:lineId',
  canWrite,
  validate({ params: payrollLineParamSchema, body: updatePayrollLineSchema }),
  asyncHandler(payrollController.updateLine)
);
router.patch(
  '/:id/finalize',
  canFinalize,
  validate({ params: payrollRunIdParamSchema }),
  asyncHandler(payrollController.finalize)
);
router.delete('/:id', canFinalize, validate({ params: payrollRunIdParamSchema }), asyncHandler(payrollController.remove));

export default router;
