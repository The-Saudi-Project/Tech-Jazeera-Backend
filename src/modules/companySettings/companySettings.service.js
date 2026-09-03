/**
 * Company settings service — a found-or-created singleton (see the model's
 * doc comment). `getCompanySettings` never throws "not found": a company
 * with no logo configured yet is the normal starting state, not an error.
 */
import CompanySettings from './companySettings.model.js';
import { deleteLogoMedia } from './logo.upload.js';
import { logAudit } from '../audit/audit.service.js';

export async function getCompanySettings() {
  const settings = await CompanySettings.findOne().lean();
  return settings ?? { logoUrl: null };
}

export async function setLogo(logoUrl, actor) {
  const previous = await CompanySettings.findOne().lean();
  const settings = await CompanySettings.findOneAndUpdate(
    {},
    { logoUrl },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  if (previous?.logoUrl) await deleteLogoMedia(previous.logoUrl);

  await logAudit({
    user: actor.userId,
    action: 'companySettings.logo.set',
    targetType: 'CompanySettings',
    targetId: settings._id,
    ip: actor.ip,
  });
  return settings;
}

export async function removeLogo(actor) {
  const previous = await CompanySettings.findOne().lean();
  const settings = await CompanySettings.findOneAndUpdate(
    {},
    { logoUrl: null },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  if (previous?.logoUrl) await deleteLogoMedia(previous.logoUrl);

  await logAudit({
    user: actor.userId,
    action: 'companySettings.logo.remove',
    targetType: 'CompanySettings',
    targetId: settings._id,
    ip: actor.ip,
  });
  return settings;
}
