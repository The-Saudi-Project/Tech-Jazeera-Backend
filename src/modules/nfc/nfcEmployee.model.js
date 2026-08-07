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
    jobTitle: { type: String, trim: true },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    linkedin: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 600 },
    // Stored profile photo filename (served publicly via /nfc-media/<photo>).
    photo: { type: String, default: null },
    idNumber: { type: String, trim: true }, // Iqama / national ID (internal only)
    notes: { type: String, trim: true, maxlength: 2000 }, // internal only
  },
  { timestamps: true }
);

nfcEmployeeSchema.index({ name: 1 });

export default mongoose.model('NfcEmployee', nfcEmployeeSchema);
