/**
 * Company settings routes. Every route beyond requireAuth is gated by the
 * controller's own dynamic canManageCompanySettings check (Admin/Manager/
 * manageRoles member) EXCEPT changing manageRoles itself, which is a
 * static, literal Admin-only rule — a broader editor of company details
 * should not be able to grant that same access to someone else. Visible in
 * the nav to every staff role (dynamic eligibility can't be expressed as a
 * static per-role nav filter); a non-eligible viewer gets this page's own
 * explained 403, not a route redirect — same pattern as the Approval Log.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { updateCompanySettingsSchema, updateManageRolesSchema } from './companySettings.validation.js';
import { uploadLogoImage } from './logo.upload.js';
import * as companySettingsController from './companySettings.controller.js';

const router = Router();

router.use(requireAuth, requireStaff);

router.get('/', asyncHandler(companySettingsController.get));
router.patch('/', validate({ body: updateCompanySettingsSchema }), asyncHandler(companySettingsController.update));
router.patch(
  '/manage-roles',
  requireRoles('Admin'),
  validate({ body: updateManageRolesSchema }),
  asyncHandler(companySettingsController.updateManageRoles)
);
router.post('/logo', uploadLogoImage, asyncHandler(companySettingsController.uploadLogo));
router.delete('/logo', asyncHandler(companySettingsController.removeLogo));

export default router;
