/**
 * CompanySettings — a true singleton (exactly one document, found-or-created
 * lazily by the service — never addressed by id). Starts with just the one
 * field the app actually needs today (the logo embedded in the Timesheet
 * Processor's export); a real company-wide settings record was anticipated
 * back in P3-D ("no company Settings record exists yet, so no CR number/
 * signatory is invented") but never built until there was a concrete need —
 * this is that need. Add fields here later (company name, CR number,
 * address) exactly when another feature actually requires one, not before.
 */
import mongoose from 'mongoose';

const companySettingsSchema = new mongoose.Schema(
  {
    // A public Cloudinary URL, same pattern as User.avatarUrl / NFC media —
    // rendered/fetched directly, not behind a signed-URL document flow
    // (a company logo isn't sensitive the way a passport scan is).
    logoUrl: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('CompanySettings', companySettingsSchema);
