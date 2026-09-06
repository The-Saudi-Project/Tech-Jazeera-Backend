/**
 * Section Access routes. The control panel itself (list/update every
 * section's grants) is Admin-only, full stop. `GET /:sectionKey/mine` is the
 * one exception — any authenticated user may ask "am I allowed into this
 * section", so a page can hide a gated button/CTA it already knows would
 * 403, without exposing WHO ELSE has access.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { sectionKeyParamSchema, updateSectionAccessSchema } from './sectionAccess.validation.js';
import * as sectionAccessController from './sectionAccess.controller.js';

const router = Router();

router.get(
  '/:sectionKey/mine',
  requireAuth,
  validate({ params: sectionKeyParamSchema }),
  asyncHandler(sectionAccessController.mine)
);

router.use(requireAuth, requireRoles('Admin'));

router.get('/', asyncHandler(sectionAccessController.list));
router.patch(
  '/:sectionKey',
  validate({ params: sectionKeyParamSchema, body: updateSectionAccessSchema }),
  asyncHandler(sectionAccessController.update)
);

export default router;
