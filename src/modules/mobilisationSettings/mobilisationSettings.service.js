/**
 * MobilisationSettings service — a found-or-created singleton (see the
 * model's doc comment). `getMobilisationSettings` never throws "not found":
 * no custom stale-warning threshold configured yet is the normal starting
 * state, not an error.
 */
import MobilisationSettings from './mobilisationSettings.model.js';
import { logAudit } from '../audit/audit.service.js';

const EMPTY = { officeSecretaryStaleDays: 180 };

// .lean() bypasses Mongoose's schema-level `default` entirely — it only
// ever applies at document creation, not on every read — so a singleton
// that existed before `officeSecretaryStaleDays` was added (this app's own
// real production settings doc, notably) would read back `undefined`
// forever until explicitly saved again. Normalized here so callers (the
// stale-mobilisation job's date math, in particular) never see anything
// but a real number.
function withDefaults(settings) {
  if (!settings) return EMPTY;
  return { ...settings, officeSecretaryStaleDays: settings.officeSecretaryStaleDays ?? 180 };
}

export async function getMobilisationSettings() {
  const settings = await MobilisationSettings.findOne().lean();
  return withDefaults(settings);
}

export async function updateMobilisationSettings(data, actor) {
  const settings = await MobilisationSettings.findOneAndUpdate({}, data, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).lean();

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
