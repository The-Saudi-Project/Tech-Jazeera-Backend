/**
 * Company settings service — a found-or-created singleton (see the model's
 * doc comment). `getCompanySettings` never throws "not found": a company
 * with no logo configured yet is the normal starting state, not an error.
 */
import CompanySettings from './companySettings.model.js';
import { deleteLogoMedia } from './logo.upload.js';
import { logAudit } from '../audit/audit.service.js';
import logger from '../../config/logger.js';

export async function getCompanySettings() {
  const settings = await CompanySettings.findOne().lean();
  return settings ?? { logoUrl: null };
}

/**
 * Fetch the configured logo's actual bytes, ready to embed via exceljs
 * (which needs a buffer, not a URL) — shared by every Excel export that
 * brands itself with the company logo (Timesheet Processor, the real-
 * attendance monthly report). Uploaded as PNG unconditionally (see
 * logo.upload.js), so the extension is always known. Returns null — never
 * throws — if no logo is configured, or if the fetch fails: a transient
 * Cloudinary hiccup should degrade to "no logo" on export, not block
 * someone from getting a payroll-critical report out.
 */
export async function getLogoForEmbedding() {
  const settings = await getCompanySettings();
  if (!settings.logoUrl) return null;
  try {
    const upstream = await fetch(settings.logoUrl);
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    return { buffer: Buffer.from(await upstream.arrayBuffer()), extension: 'png' };
  } catch (err) {
    logger.warn(`[companySettings] failed to fetch logo for embedding: ${err.message}`);
    return null;
  }
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
