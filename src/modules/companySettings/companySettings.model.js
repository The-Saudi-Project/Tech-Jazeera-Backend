/**
 * CompanySettings — a true singleton (exactly one document, found-or-created
 * lazily by the service — never addressed by id). Started with just the logo
 * (embedded in the Timesheet Processor's export); expanded to the full
 * company profile anticipated back in P3-D ("no company Settings record
 * exists yet, so no CR number/signatory is invented") once a concrete need
 * showed up — a real letterhead on every generated PDF (invoices,
 * quotations, EOSB settlements, certificates, payslips), not just the one
 * export that already had a logo band.
 *
 * `manageRoles` — ApprovalRoles (e.g. BDM, COO, GM) granted the same edit
 * access as Admin/Manager over the company-detail fields below, same
 * "admin-configurable list of ApprovalRole ids" pattern as
 * MobilisationSettings.viewerRoles — deliberately its OWN list, not a reuse
 * of MobilisationSettings', so changing who can see mobilisations can never
 * silently change who can edit the company's legal/bank identity. Changing
 * THIS list itself is Admin-only (see companySettings.service.js) — a
 * broader editor of company details should not be able to grant that access
 * to someone else.
 */
import mongoose from 'mongoose';

const companySettingsSchema = new mongoose.Schema(
  {
    // A public Cloudinary URL, same pattern as User.avatarUrl / NFC media —
    // rendered/fetched directly, not behind a signed-URL document flow
    // (a company logo isn't sensitive the way a passport scan is).
    logoUrl: { type: String, default: null },

    // Legal identity — printed on every document's letterhead.
    companyName: { type: String, trim: true, default: null },
    companyNameAr: { type: String, trim: true, default: null },
    crNumber: { type: String, trim: true, default: null },
    vatNumber: { type: String, trim: true, default: null },

    // Contact & address.
    address: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, default: null },
    website: { type: String, trim: true, default: null },

    // Bank details — shown on invoices as payment instructions.
    bankName: { type: String, trim: true, default: null },
    bankIban: { type: String, trim: true, default: null },

    // Authorized signatory — printed on certificates/official letters.
    signatoryName: { type: String, trim: true, default: null },
    signatoryTitle: { type: String, trim: true, default: null },

    manageRoles: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRole' }], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('CompanySettings', companySettingsSchema);
