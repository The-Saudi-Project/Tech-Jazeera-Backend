/**
 * MobilisationSettings — a true singleton (exactly one document,
 * found-or-created lazily by the service — never addressed by id), same
 * pattern as CompanySettings.
 *
 * `officeSecretaryStaleDays` — how long a mobilisation may sit PendingReview
 * with no decision before mobilisationStale.job.js warns every Manager
 * login. Default 180 (~6 months), matching the original ask. Named for the
 * usual first step (Office Secretary review), but the check itself is
 * step-agnostic — see the job's own doc comment for why.
 *
 * The viewer-circle and self-mobilise role lists that used to live here
 * (`viewerRoles`/`selfMobiliseRoles`) moved to Section Access's
 * `mobilisationsViewer`/`mobilisationsSelfMobilise` keys — see
 * sectionAccess.model.js — so there's one place to configure every module's
 * access instead of a one-off copy of the same idea per module.
 */
import mongoose from 'mongoose';

const mobilisationSettingsSchema = new mongoose.Schema(
  {
    officeSecretaryStaleDays: { type: Number, default: 180, min: 1, max: 3650 },
  },
  { timestamps: true }
);

export default mongoose.model('MobilisationSettings', mobilisationSettingsSchema);
