/**
 * Company settings controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import * as companySettingsService from './companySettings.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** GET /api/company-settings   (Admin) */
export async function get(req, res) {
  const settings = await companySettingsService.getCompanySettings();
  res.json(new ApiResponse('Company settings.', settings));
}

/** POST /api/company-settings/logo   (Admin) — multipart, field `logo` */
export async function uploadLogo(req, res) {
  if (!req.file) throw new ApiError(400, 'Please attach a logo image.');
  const settings = await companySettingsService.setLogo(req.file.path, actor(req));
  res.status(201).json(new ApiResponse('Logo updated.', settings));
}

/** DELETE /api/company-settings/logo   (Admin) */
export async function removeLogo(req, res) {
  const settings = await companySettingsService.removeLogo(actor(req));
  res.json(new ApiResponse('Logo removed.', settings));
}
