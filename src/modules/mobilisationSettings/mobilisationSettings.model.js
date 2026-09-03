/**
 * MobilisationSettings — a true singleton (exactly one document,
 * found-or-created lazily by the service — never addressed by id), same
 * pattern as CompanySettings.
 *
 * `viewerRoles` — ApprovalRoles (e.g. BDM, Marketing Manager, FM, COO, GM)
 * granted full read-only access to every mobilisation once it leaves Draft
 * (immediately on submit for BDM's "read on version," and after approval
 * for the whole upper circle) — one admin-configurable list, no per-role
 * special-casing. Deliberately separate from the workflow's own decision
 * step: visibility here is passive viewing, not decision authority, and the
 * company's real org chart includes roles (e.g. HR) that sit in the
 * Approval Hierarchy elsewhere but should NOT automatically see
 * mobilisations — so the generic "any ApprovalRole member" check used by
 * the Approval Log is deliberately NOT reused here.
 *
 * `selfMobiliseRoles` — ApprovalRoles allowed to create a mobilisation
 * directly as its own primary coordinator, in addition to any User.role
 * 'Coordinator' (e.g. BDM/Marketing Manager self-mobilising, per the
 * original requirement).
 */
import mongoose from 'mongoose';

const mobilisationSettingsSchema = new mongoose.Schema(
  {
    viewerRoles: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRole' }], default: [] },
    selfMobiliseRoles: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRole' }], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('MobilisationSettings', mobilisationSettingsSchema);
