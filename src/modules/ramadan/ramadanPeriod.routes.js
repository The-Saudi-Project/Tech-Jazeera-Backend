/**
 * RamadanPeriod routes (P3-E). Mirrors holiday.routes.js's exact role split:
 * read-open to any authenticated user, write gated to Admin/Manager/HR.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createRamadanPeriodSchema,
  updateRamadanPeriodSchema,
  listRamadanPeriodsSchema,
  ramadanPeriodIdParamSchema,
} from './ramadanPeriod.validation.js';
import * as ramadanPeriodController from './ramadanPeriod.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listRamadanPeriodsSchema }), asyncHandler(ramadanPeriodController.list));
router.post(
  '/',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ body: createRamadanPeriodSchema }),
  asyncHandler(ramadanPeriodController.create)
);
router.patch(
  '/:id',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: ramadanPeriodIdParamSchema, body: updateRamadanPeriodSchema }),
  asyncHandler(ramadanPeriodController.update)
);
router.delete(
  '/:id',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: ramadanPeriodIdParamSchema }),
  asyncHandler(ramadanPeriodController.remove)
);

export default router;
