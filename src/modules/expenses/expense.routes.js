/**
 * Expense routes (P2-M7) — internal cost data (rent, external salaries,
 * purchases). Access is the generic, admin-configurable Section Access
 * mechanism (see sectionAccess.model.js), same as Payroll: by default only
 * Accounts (plus Admin, always) can reach this module, with full
 * read/write/delete as one unified circle — no separate view/write/delete
 * tiers. An Admin can extend that circle to specific roles or ApprovalRoles
 * (e.g. a "Financial Manager"/"COO"-named role) from the Section Access
 * settings page. Every mutation is still audit-logged (see
 * expense.service.js's logAudit calls).
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireSectionAccess } from '../sectionAccess/sectionAccess.middleware.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingle } from '../../middleware/upload.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
  summaryQuerySchema,
  expenseIdParamSchema,
} from './expense.validation.js';
import * as expenseController from './expense.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireSectionAccess('expenses'));

router.get('/', validate({ query: listExpensesSchema }), asyncHandler(expenseController.list));
router.get('/summary', validate({ query: summaryQuerySchema }), asyncHandler(expenseController.summary));
router.get('/:id', validate({ params: expenseIdParamSchema }), asyncHandler(expenseController.get));
router.get('/:id/receipt', validate({ params: expenseIdParamSchema }), asyncHandler(expenseController.receipt));
router.post('/', uploadSingle, validate({ body: createExpenseSchema }), asyncHandler(expenseController.create));
router.patch(
  '/:id',
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  asyncHandler(expenseController.update)
);
router.delete('/:id', validate({ params: expenseIdParamSchema }), asyncHandler(expenseController.remove));

export default router;
