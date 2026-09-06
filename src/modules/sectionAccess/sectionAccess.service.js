/**
 * SectionAccess service — see the model's doc comment for the mechanism.
 * `getSectionAccess`/`canAccessSection` never throw "not configured": a
 * section nobody has touched yet falls back to DEFAULT_ALLOWED_ROLES, the
 * same "found-or-created default" posture CompanySettings uses.
 */
import SectionAccess, { SECTION_KEYS } from './sectionAccess.model.js';
import ApprovalRole from '../approvals/approvalRole.model.js';
import { isMemberOfAnyRole } from '../approvals/approvals.service.js';
import { STAFF_ROLES } from '../../middleware/rbac.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../audit/audit.service.js';

/** The floor before an Admin ever opens the new settings screen — preserves
 *  each section's real pre-existing operational owner (Accounts already
 *  touched both Payroll and Expenses) while Manager/HR no longer get in by
 *  default now that this is admin-configurable per section. `employeeCreate`
 *  defaults to nobody but Admin — "until then only admin can add employees,"
 *  the user's own words when asking for this. */
const DEFAULT_ALLOWED_ROLES = {
  payroll: ['Accounts'],
  expenses: ['Accounts'],
  employeeCreate: [],
};

const SECTION_LABELS = {
  payroll: 'Payroll',
  expenses: 'Expenses',
  employeeCreate: 'Adding employees',
};

const SECTION_DESCRIPTIONS = {
  payroll: 'Monthly runs, payslips, and finalizing a period.',
  expenses: 'Recording and managing the company expense ledger.',
  employeeCreate: 'Creating a new employee record — Admin only until you grant someone else this specifically.',
};

function defaultFor(sectionKey) {
  return { sectionKey, allowedRoles: DEFAULT_ALLOWED_ROLES[sectionKey] ?? [], allowedApprovalRoles: [] };
}

export async function getSectionAccess(sectionKey) {
  const doc = await SectionAccess.findOne({ sectionKey }).lean();
  return doc ?? defaultFor(sectionKey);
}

/** Every governed section's current settings, populated for the admin UI —
 *  always returns one row per SECTION_KEYS entry, defaulted ones included. */
export async function listSectionAccess() {
  const docs = await SectionAccess.find({}).populate('allowedApprovalRoles', 'name').lean();
  const bySectionKey = new Map(docs.map((d) => [d.sectionKey, d]));
  return SECTION_KEYS.map((key) => ({
    ...(bySectionKey.get(key) ?? defaultFor(key)),
    sectionKey: key,
    label: SECTION_LABELS[key],
    description: SECTION_DESCRIPTIONS[key],
  }));
}

/**
 * Worker/Staff (the ESS self-service personas) are excluded outright,
 * regardless of configuration — the same floor requireStaff/
 * requireStaffOrExecutive enforce everywhere else; this mechanism only ever
 * ADDS access on top of it, never bypasses it. Admin always passes beyond
 * that floor (so an Admin can never configure themselves out of a section
 * they built). Beyond both: a literal role match in `allowedRoles`, or real
 * ApprovalRole membership in `allowedApprovalRoles` — same membership check
 * the Configurable Approval Hierarchy engine uses. Shared by
 * requireSectionAccess (the route gate) and the "mine" endpoint (a button's
 * "should I even show this" check) so the floor only lives in one place.
 */
export async function canAccessSection(sectionKey, actor) {
  if (!STAFF_ROLES.includes(actor.role) && actor.role !== 'Executive') return false;
  if (actor.role === 'Admin') return true;
  const settings = await getSectionAccess(sectionKey);
  if (settings.allowedRoles.includes(actor.role)) return true;
  if (settings.allowedApprovalRoles.length) {
    return isMemberOfAnyRole(actor.userId, settings.allowedApprovalRoles);
  }
  return false;
}

export async function getMySectionAccess(actor) {
  const allowed = [];
  for (const key of SECTION_KEYS) {
    if (await canAccessSection(key, actor)) {
      allowed.push(key);
    }
  }
  return allowed;
}

async function assertValidApprovalRoles(roleIds) {
  if (!roleIds?.length) return;
  const count = await ApprovalRole.countDocuments({ _id: { $in: roleIds }, isActive: true });
  if (count !== new Set(roleIds.map(String)).size) {
    throw new ApiError(400, 'One or more selected approval roles are invalid or inactive.');
  }
}

/** Admin-only (enforced by the route) — deciding who else can open a
 *  section is not itself delegable to whoever that grant creates. */
export async function updateSectionAccess(sectionKey, { allowedRoles, allowedApprovalRoles }, actor) {
  if (!SECTION_KEYS.includes(sectionKey)) throw new ApiError(404, 'Unknown section.');
  await assertValidApprovalRoles(allowedApprovalRoles);

  const settings = await SectionAccess.findOneAndUpdate(
    { sectionKey },
    { sectionKey, allowedRoles, allowedApprovalRoles },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate('allowedApprovalRoles', 'name')
    .lean();

  await logAudit({
    user: actor.userId,
    action: 'sectionAccess.update',
    targetType: 'SectionAccess',
    targetId: settings._id,
    meta: { sectionKey, allowedRoles, approvalRoleCount: allowedApprovalRoles?.length ?? 0 },
    ip: actor.ip,
  });
  return { ...settings, label: SECTION_LABELS[sectionKey], description: SECTION_DESCRIPTIONS[sectionKey] };
}
