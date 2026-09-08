/**
 * Invoice routes (P2-M6).
 *
 * Roles: invoices are financial documents — Section Access key 'invoices'
 * governs everything below except delete (Admin/Manager only, an extra
 * safety rail on the single most destructive action, same posture as
 * Quotations/Clients — see sectionAccess.model.js's design notes). Read
 * narrows from "any staff" to the 'invoices' circle now — a deliberate
 * change per the financial-document classification, not an oversight.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { requireSectionAccess } from '../sectionAccess/sectionAccess.middleware.js';
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
router.use(requireSectionAccess('invoices'));

const canDelete = requireRoles('Admin', 'Manager');

router.get('/', validate({ query: listInvoicesSchema }), asyncHandler(invoiceController.list));
router.get('/:id', validate({ params: invoiceIdParamSchema }), asyncHandler(invoiceController.get));
router.get('/:id/pdf', validate({ params: invoiceIdParamSchema }), asyncHandler(invoiceController.pdf));
router.post('/', validate({ body: createInvoiceSchema }), asyncHandler(invoiceController.create));
router.post(
  '/:id/payments',
  validate({ params: invoiceIdParamSchema, body: recordPaymentSchema }),
  asyncHandler(invoiceController.recordPayment)
);
router.delete('/:id', canDelete, validate({ params: invoiceIdParamSchema }), asyncHandler(invoiceController.remove));

export default router;
