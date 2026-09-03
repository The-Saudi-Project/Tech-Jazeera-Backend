/**
 * MobilisationSettings controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as settingsService from './mobilisationSettings.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** GET /api/mobilisation-settings   (Admin) */
export async function get(req, res) {
  const settings = await settingsService.getMobilisationSettingsPopulated();
  res.json(new ApiResponse('Mobilisation settings.', settings));
}

/** PATCH /api/mobilisation-settings   (Admin) */
export async function update(req, res) {
  const settings = await settingsService.updateMobilisationSettings(req.body, actor(req));
  res.json(new ApiResponse('Mobilisation settings updated.', settings));
}
