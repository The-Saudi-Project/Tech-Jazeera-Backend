/**
 * Company settings controller — HTTP translation only. The edit circle
 * (Admin/Manager/manageRoles member) is dynamic — can't be a static
 * requireRoles(...) — so every action checks it here itself, same pattern
 * as the Approval Log's own "Admin, or a real member" gate.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import * as companySettingsService from './companySettings.service.js';

const actor = (req) => ({ userId: req.user.id, role: req.user.role, ip: req.ip });

async function assertCanManage(req) {
  const allowed = await companySettingsService.canManageCompanySettings(actor(req));
  if (!allowed) throw new ApiError(403, 'You do not have permission to manage company settings.');
}

/** GET /api/company-settings   (Admin/Manager/manageRoles member) */
export async function get(req, res) {
  await assertCanManage(req);
  const settings = await companySettingsService.getCompanySettingsPopulated();
  res.json(new ApiResponse('Company settings.', settings));
}

/** PATCH /api/company-settings   (Admin/Manager/manageRoles member) */
export async function update(req, res) {
  await assertCanManage(req);
  const settings = await companySettingsService.updateCompanySettings(req.body, actor(req));
  res.json(new ApiResponse('Company settings updated.', settings));
}

/** PATCH /api/company-settings/manage-roles   (Admin only) */
export async function updateManageRoles(req, res) {
  const settings = await companySettingsService.updateManageRoles(req.body.manageRoles, actor(req));
  res.json(new ApiResponse('Access list updated.', settings));
}

/** POST /api/company-settings/logo   (Admin/Manager/manageRoles member) — multipart, field `logo` */
export async function uploadLogo(req, res) {
  await assertCanManage(req);
  if (!req.file) throw new ApiError(400, 'Please attach a logo image.');
  const settings = await companySettingsService.setLogo(req.file.path, actor(req));
  res.status(201).json(new ApiResponse('Logo updated.', settings));
}

/** DELETE /api/company-settings/logo   (Admin/Manager/manageRoles member) */
export async function removeLogo(req, res) {
  await assertCanManage(req);
  const settings = await companySettingsService.removeLogo(actor(req));
  res.json(new ApiResponse('Logo removed.', settings));
}
