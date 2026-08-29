/**
 * Expense routes (P2-M7).
 *
 * Roles: this is internal cost data (rent, external salaries, purchases) —
 * a narrower view circle than Invoices' "any authenticated staff", matching
 * the same Admin/Manager/HR/Accounts circle already used for Payroll/EOSB.
 * Entering an expense is a money action (Admin/Manager/Accounts, not HR);
 * deleting is Admin/Manager only, same as Invoice.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
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
router.use(requireRoles('Admin', 'Manager', 'HR', 'Accounts'));

const canWrite = requireRoles('Admin', 'Manager', 'Accounts');
const canDelete = requireRoles('Admin', 'Manager');

router.get('/', validate({ query: listExpensesSchema }), asyncHandler(expenseController.list));
router.get('/summary', validate({ query: summaryQuerySchema }), asyncHandler(expenseController.summary));
router.get('/:id', validate({ params: expenseIdParamSchema }), asyncHandler(expenseController.get));
router.get('/:id/receipt', validate({ params: expenseIdParamSchema }), asyncHandler(expenseController.receipt));
router.post(
  '/',
  canWrite,
  uploadSingle,
  validate({ body: createExpenseSchema }),
  asyncHandler(expenseController.create)
);
router.patch(
  '/:id',
  canWrite,
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  asyncHandler(expenseController.update)
);
router.delete('/:id', canDelete, validate({ params: expenseIdParamSchema }), asyncHandler(expenseController.remove));

export default router;
