/**
 * Financial requests routes (P3-C) — the staff-facing half. Workers submit
 * their own advance/reimbursement requests through /api/me instead (see the
 * `me` module); this router is the review queue plus the actions only staff
 * perform (decide, record a repayment, mark paid).
 *
 * Roles: approving is Admin/Manager/HR (an HR/management call); recording
 * money actually changing hands (a repayment, marking a claim paid) also
 * includes Accounts, who handles that in practice.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  decideAdvanceSchema,
  addRepaymentSchema,
  listAdvancesSchema,
  advanceIdParamSchema,
} from './advance.validation.js';
import {
  decideReimbursementSchema,
  listReimbursementsSchema,
  reimbursementIdParamSchema,
} from './reimbursement.validation.js';
import * as advanceController from './advance.controller.js';
import * as reimbursementController from './reimbursement.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('Admin', 'Manager', 'HR', 'Accounts'));

const canDecide = requireRoles('Admin', 'Manager', 'HR');
const canHandleMoney = requireRoles('Admin', 'Manager', 'HR', 'Accounts');

router.get('/advances', validate({ query: listAdvancesSchema }), asyncHandler(advanceController.list));
router.patch(
  '/advances/:id/decide',
  canDecide,
  validate({ params: advanceIdParamSchema, body: decideAdvanceSchema }),
  asyncHandler(advanceController.decide)
);
router.post(
  '/advances/:id/repayments',
  canHandleMoney,
  validate({ params: advanceIdParamSchema, body: addRepaymentSchema }),
  asyncHandler(advanceController.addRepayment)
);

router.get('/reimbursements', validate({ query: listReimbursementsSchema }), asyncHandler(reimbursementController.list));
router.get(
  '/reimbursements/:id/receipt',
  validate({ params: reimbursementIdParamSchema }),
  asyncHandler(reimbursementController.receipt)
);
router.patch(
  '/reimbursements/:id/decide',
  canDecide,
  validate({ params: reimbursementIdParamSchema, body: decideReimbursementSchema }),
  asyncHandler(reimbursementController.decide)
);
router.patch(
  '/reimbursements/:id/pay',
  canHandleMoney,
  validate({ params: reimbursementIdParamSchema }),
  asyncHandler(reimbursementController.markPaid)
);

export default router;
