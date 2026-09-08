/**
 * Subcontractor routes.
 *
 * Role design: everyone staff may READ (Coordinators need it for the
 * mobilisation-create picker). WRITE/DELETE is Section Access key
 * 'subcontractorsManage', default ['Manager'] — matches today's
 * Admin/Manager circle exactly. Delete is folded into the same key rather
 * than kept separately hardcoded, since it was already the same tier as
 * create/update here (no stricter delete-only circle to preserve as an
 * extra safety rail) — same reasoning as EOSB's collapse.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireStaff } from '../../middleware/rbac.js';
import { requireSectionAccess } from '../sectionAccess/sectionAccess.middleware.js';
import { validate } from '../../middleware/validate.js';
import {
  createSubcontractorSchema,
  updateSubcontractorSchema,
  listSubcontractorsSchema,
  subcontractorIdParamSchema,
} from './subcontractor.validation.js';
import * as subcontractorController from './subcontractor.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff);

const canWrite = requireSectionAccess('subcontractorsManage');

router.get('/', validate({ query: listSubcontractorsSchema }), asyncHandler(subcontractorController.list));
router.get('/:id', validate({ params: subcontractorIdParamSchema }), asyncHandler(subcontractorController.get));
router.post(
  '/',
  canWrite,
  validate({ body: createSubcontractorSchema }),
  asyncHandler(subcontractorController.create)
);
router.patch(
  '/:id',
  canWrite,
  validate({ params: subcontractorIdParamSchema, body: updateSubcontractorSchema }),
  asyncHandler(subcontractorController.update)
);
router.delete(
  '/:id',
  canWrite,
  validate({ params: subcontractorIdParamSchema }),
  asyncHandler(subcontractorController.remove)
);

export default router;
