/**
 * RamadanPeriod routes (P3-E). Read-open to any authenticated user; write
 * (create/update/delete, one circle — there was never a stricter delete-only
 * tier here) is Section Access key 'ramadanManage', default ['Manager','HR']
 * — matches today's Admin/Manager/HR circle exactly.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireSectionAccess } from '../sectionAccess/sectionAccess.middleware.js';
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

const canManageRamadan = requireSectionAccess('ramadanManage');

router.get('/', validate({ query: listRamadanPeriodsSchema }), asyncHandler(ramadanPeriodController.list));
router.post(
  '/',
  canManageRamadan,
  validate({ body: createRamadanPeriodSchema }),
  asyncHandler(ramadanPeriodController.create)
);
router.patch(
  '/:id',
  canManageRamadan,
  validate({ params: ramadanPeriodIdParamSchema, body: updateRamadanPeriodSchema }),
  asyncHandler(ramadanPeriodController.update)
);
router.delete(
  '/:id',
  canManageRamadan,
  validate({ params: ramadanPeriodIdParamSchema }),
  asyncHandler(ramadanPeriodController.remove)
);

export default router;
