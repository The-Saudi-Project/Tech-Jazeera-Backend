/**
 * Subcontractor routes.
 *
 * Role design: everyone staff may READ (Coordinators need it for the
 * mobilisation-create picker). WRITE/DELETE is Admin/Manager only, same
 * circle as Client.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
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

const canWrite = requireRoles('Admin', 'Manager');

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
