/**
 * Quotation routes.
 *
 * Roles: quotations are commercial documents. Read/PDF for any authenticated
 * user; create/update/duplicate for Admin/Manager/Accounts; delete for
 * Admin/Manager only.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  listQuotationsSchema,
  quotationIdParamSchema,
} from './quotation.validation.js';
import * as quotationController from './quotation.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff); // staff-only module; Workers use the ESS portal (P2-M2)

const canWrite = requireRoles('Admin', 'Manager', 'Accounts');
const canDelete = requireRoles('Admin', 'Manager');

router.get('/', validate({ query: listQuotationsSchema }), asyncHandler(quotationController.list));
router.get('/:id', validate({ params: quotationIdParamSchema }), asyncHandler(quotationController.get));
router.get(
  '/:id/pdf',
  validate({ params: quotationIdParamSchema }),
  asyncHandler(quotationController.pdf)
);
router.post('/', canWrite, validate({ body: createQuotationSchema }), asyncHandler(quotationController.create));
router.post(
  '/:id/duplicate',
  canWrite,
  validate({ params: quotationIdParamSchema }),
  asyncHandler(quotationController.duplicate)
);
router.patch(
  '/:id',
  canWrite,
  validate({ params: quotationIdParamSchema, body: updateQuotationSchema }),
  asyncHandler(quotationController.update)
);
router.delete(
  '/:id',
  canDelete,
  validate({ params: quotationIdParamSchema }),
  asyncHandler(quotationController.remove)
);

export default router;
