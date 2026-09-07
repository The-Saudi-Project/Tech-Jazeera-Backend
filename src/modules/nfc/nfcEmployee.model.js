/**
 * NfcEmployee — a person under an NfcCompany whose details appear on a tap page.
 * The physical card that points at them is a separate entity (NfcCard); a person
 * can have a card assigned, reassigned, or none. Only whitelisted fields here
 * ever reach the public page.
 */
import mongoose from 'mongoose';

const nfcEmployeeSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NfcCompany',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    // Manually-entered Arabic counterparts (never auto-translated) for the
    // public page's EN/AR toggle — same optional, no-required pattern as
    // NfcCompany.companyNameAr. Blank means "fall back to the English value
    // when Arabic is selected" (see nfc.i18n.js's pickLang), never a blank line.
    nameAr: { type: String, trim: true, default: null },
    jobTitle: { type: String, trim: true },
    jobTitleAr: { type: String, trim: true, default: null },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    linkedin: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 600 },
    bioAr: { type: String, trim: true, maxlength: 600, default: null },
    // Stored profile photo filename (served publicly via /nfc-media/<photo>).
    photo: { type: String, default: null },
    idNumber: { type: String, trim: true }, // Iqama / national ID (internal only)
    notes: { type: String, trim: true, maxlength: 2000 }, // internal only
  },
  { timestamps: true }
);

nfcEmployeeSchema.index({ name: 1 });

export default mongoose.model('NfcEmployee', nfcEmployeeSchema);
