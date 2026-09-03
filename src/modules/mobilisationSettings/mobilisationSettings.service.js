/**
 * MobilisationSettings service — a found-or-created singleton (see the
 * model's doc comment). `getMobilisationSettings` never throws "not found":
 * no roles configured yet is the normal starting state, not an error.
 */
import MobilisationSettings from './mobilisationSettings.model.js';
import ApprovalRole from '../approvals/approvalRole.model.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

const EMPTY = { viewerRoles: [], selfMobiliseRoles: [] };

export async function getMobilisationSettings() {
  const settings = await MobilisationSettings.findOne().lean();
  return settings ?? EMPTY;
}

/** Same shape, but with each role populated to {_id, name} for the admin UI. */
export async function getMobilisationSettingsPopulated() {
  const settings = await MobilisationSettings.findOne()
    .populate('viewerRoles', 'name')
    .populate('selfMobiliseRoles', 'name')
    .lean();
  return settings ?? EMPTY;
}

async function assertValidRoles(roleIds) {
  if (!roleIds?.length) return;
  const count = await ApprovalRole.countDocuments({ _id: { $in: roleIds }, isActive: true });
  if (count !== new Set(roleIds.map(String)).size) {
    throw new ApiError(400, 'One or more selected roles are invalid or inactive.');
  }
}

export async function updateMobilisationSettings(data, actor) {
  if (data.viewerRoles) await assertValidRoles(data.viewerRoles);
  if (data.selfMobiliseRoles) await assertValidRoles(data.selfMobiliseRoles);

  const settings = await MobilisationSettings.findOneAndUpdate({}, data, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  })
    .populate('viewerRoles', 'name')
    .populate('selfMobiliseRoles', 'name')
    .lean();

  await logAudit({
    user: actor.userId,
    action: 'mobilisationSettings.update',
    targetType: 'MobilisationSettings',
    targetId: settings._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return settings;
}
