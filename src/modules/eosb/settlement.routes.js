/**
 * EOSB settlement routes (P3-A).
 *
 * Roles: this is a financial/HR-compliance document. Read/PDF for
 * Admin/Manager/HR/Accounts (Accounts needs the figure to actually pay it);
 * create/delete restricted to Admin/Manager/HR — computing a settlement is
 * an HR action about an employee's exit, not an accounting one.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createSettlementSchema, listSettlementsSchema, settlementIdParamSchema } from './settlement.validation.js';
import * as settlementController from './settlement.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('Admin', 'Manager', 'HR', 'Accounts'));

const canWrite = requireRoles('Admin', 'Manager', 'HR');

router.get('/', validate({ query: listSettlementsSchema }), asyncHandler(settlementController.list));
router.get('/:id', validate({ params: settlementIdParamSchema }), asyncHandler(settlementController.get));
router.get('/:id/pdf', validate({ params: settlementIdParamSchema }), asyncHandler(settlementController.pdf));
router.post('/', canWrite, validate({ body: createSettlementSchema }), asyncHandler(settlementController.create));
router.delete('/:id', canWrite, validate({ params: settlementIdParamSchema }), asyncHandler(settlementController.remove));

export default router;
