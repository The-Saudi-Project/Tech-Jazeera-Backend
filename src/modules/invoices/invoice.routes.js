/**
 * Invoice routes (P2-M6).
 *
 * Roles: invoices are commercial documents, same circle as quotations —
 * read/PDF for any authenticated staff; create/record-payment for
 * Admin/Manager/Accounts; delete for Admin/Manager only.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createInvoiceSchema,
  recordPaymentSchema,
  listInvoicesSchema,
  invoiceIdParamSchema,
} from './invoice.validation.js';
import * as invoiceController from './invoice.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff);

const canWrite = requireRoles('Admin', 'Manager', 'Accounts');
const canDelete = requireRoles('Admin', 'Manager');

router.get('/', validate({ query: listInvoicesSchema }), asyncHandler(invoiceController.list));
router.get('/:id', validate({ params: invoiceIdParamSchema }), asyncHandler(invoiceController.get));
router.get('/:id/pdf', validate({ params: invoiceIdParamSchema }), asyncHandler(invoiceController.pdf));
router.post('/', canWrite, validate({ body: createInvoiceSchema }), asyncHandler(invoiceController.create));
router.post(
  '/:id/payments',
  canWrite,
  validate({ params: invoiceIdParamSchema, body: recordPaymentSchema }),
  asyncHandler(invoiceController.recordPayment)
);
router.delete('/:id', canDelete, validate({ params: invoiceIdParamSchema }), asyncHandler(invoiceController.remove));

export default router;
