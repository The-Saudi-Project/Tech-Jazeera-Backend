/**
 * Asset routes (P3-D). Staff-only module — a Worker's own assigned assets
 * are read through /api/me/assets instead (see the `me` module).
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createAssetSchema,
  updateAssetSchema,
  setAssetStatusSchema,
  assignAssetSchema,
  returnAssetSchema,
  listAssetsSchema,
  assetIdParamSchema,
  employeeIdParamSchema,
} from './asset.validation.js';
import * as assetController from './asset.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff);

const canWrite = requireRoles('Admin', 'Manager', 'HR');
const canDelete = requireRoles('Admin', 'HR');

router.get('/', validate({ query: listAssetsSchema }), asyncHandler(assetController.list));
// Before the /:id catch-all, or "by-employee" is read as an asset id.
router.get(
  '/by-employee/:employeeId',
  validate({ params: employeeIdParamSchema }),
  asyncHandler(assetController.listByEmployee)
);
router.get('/:id', validate({ params: assetIdParamSchema }), asyncHandler(assetController.get));
router.post('/', canWrite, validate({ body: createAssetSchema }), asyncHandler(assetController.create));
router.patch(
  '/:id',
  canWrite,
  validate({ params: assetIdParamSchema, body: updateAssetSchema }),
  asyncHandler(assetController.update)
);
router.patch(
  '/:id/status',
  canWrite,
  validate({ params: assetIdParamSchema, body: setAssetStatusSchema }),
  asyncHandler(assetController.setStatus)
);
router.post(
  '/:id/assign',
  canWrite,
  validate({ params: assetIdParamSchema, body: assignAssetSchema }),
  asyncHandler(assetController.assign)
);
router.post(
  '/:id/return',
  canWrite,
  validate({ params: assetIdParamSchema, body: returnAssetSchema }),
  asyncHandler(assetController.returnAsset)
);
router.delete('/:id', canDelete, validate({ params: assetIdParamSchema }), asyncHandler(assetController.remove));

export default router;
