/**
 * Company settings service — a found-or-created singleton (see the model's
 * doc comment). `getCompanySettings` never throws "not found": a company
 * with no logo/details configured yet is the normal starting state, not an
 * error.
 */
import CompanySettings from './companySettings.model.js';
import ApprovalRole from '../approvals/approvalRole.model.js';
import { isMemberOfAnyRole } from '../approvals/approvals.service.js';
import { deleteLogoMedia } from './logo.upload.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';
import logger from '../../config/logger.js';

const EMPTY = {
  logoUrl: null,
  companyName: null,
  companyNameAr: null,
  crNumber: null,
  vatNumber: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  bankName: null,
  bankIban: null,
  signatoryName: null,
  signatoryTitle: null,
  manageRoles: [],
};

export async function getCompanySettings() {
  const settings = await CompanySettings.findOne().lean();
  return settings ?? EMPTY;
}

/** Same shape, but with manageRoles populated to {_id, name} for the admin UI. */
export async function getCompanySettingsPopulated() {
  const settings = await CompanySettings.findOne().populate('manageRoles', 'name').lean();
  return settings ?? EMPTY;
}

/**
 * Admin and Manager always may edit; beyond that, whoever the company put in
 * `manageRoles` (e.g. BDM, COO, GM) — an admin-configurable circle, not a
 * hardcoded one, since ApprovalRole names are themselves admin-named and
 * this app never matches on them by literal string.
 */
export async function canManageCompanySettings(actor) {
  if (actor.role === 'Admin' || actor.role === 'Manager') return true;
  const settings = await getCompanySettings();
  return isMemberOfAnyRole(actor.userId, settings.manageRoles);
}

async function assertValidRoles(roleIds) {
  if (!roleIds?.length) return;
  const count = await ApprovalRole.countDocuments({ _id: { $in: roleIds }, isActive: true });
  if (count !== new Set(roleIds.map(String)).size) {
    throw new ApiError(400, 'One or more selected roles are invalid or inactive.');
  }
}

export async function updateCompanySettings(data, actor) {
  const settings = await CompanySettings.findOneAndUpdate({}, data, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  })
    .populate('manageRoles', 'name')
    .lean();

  await logAudit({
    user: actor.userId,
    action: 'companySettings.update',
    targetType: 'CompanySettings',
    targetId: settings._id,
    meta: { fields: Object.keys(data) },
    ip: actor.ip,
  });
  return settings;
}

/** Admin-only — see the model's doc comment for why this is separate from
 *  updateCompanySettings's broader circle. */
export async function updateManageRoles(roleIds, actor) {
  await assertValidRoles(roleIds);
  const settings = await CompanySettings.findOneAndUpdate(
    {},
    { manageRoles: roleIds },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate('manageRoles', 'name')
    .lean();

  await logAudit({
    user: actor.userId,
    action: 'companySettings.manageRoles.update',
    targetType: 'CompanySettings',
    targetId: settings._id,
    meta: { roleCount: roleIds.length },
    ip: actor.ip,
  });
  return settings;
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

/**
 * One call for every PDF generator (invoice/quotation/EOSB settlement/
 * certificate/payslip) to get everything it needs for a letterhead.
 * `company` comes back null — not a half-filled-in object — until the
 * company has set at least a name or a logo, so a document generated
 * before anyone has touched this settings page renders exactly as it did
 * before this feature existed, rather than a letterhead with a "Company
 * name not set" placeholder on a real business document.
 */
export async function getLetterheadData() {
  const settings = await getCompanySettings();
  const hasIdentity = Boolean(settings.companyName || settings.logoUrl);
  if (!hasIdentity) return { company: null, logo: null };
  const logo = await getLogoForEmbedding();
  return { company: settings, logo };
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
