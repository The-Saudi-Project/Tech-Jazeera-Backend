/**
 * Company settings routes — Admin-only, same circle as the Timesheet
 * Processor (the one consumer of `logoUrl` today).
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { uploadLogoImage } from './logo.upload.js';
import * as companySettingsController from './companySettings.controller.js';

const router = Router();

router.use(requireAuth, requireRoles('Admin'));

router.get('/', asyncHandler(companySettingsController.get));
router.post('/logo', uploadLogoImage, asyncHandler(companySettingsController.uploadLogo));
router.delete('/logo', asyncHandler(companySettingsController.removeLogo));

export default router;
