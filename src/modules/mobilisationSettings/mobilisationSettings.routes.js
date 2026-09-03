/**
 * MobilisationSettings routes — Admin-only, same circle as the Approval
 * Hierarchy's own role/workflow configuration (`/api/approvals`).
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { updateMobilisationSettingsSchema } from './mobilisationSettings.validation.js';
import * as settingsController from './mobilisationSettings.controller.js';

const router = Router();

router.use(requireAuth, requireRoles('Admin'));

router.get('/', asyncHandler(settingsController.get));
router.patch('/', validate({ body: updateMobilisationSettingsSchema }), asyncHandler(settingsController.update));

export default router;
