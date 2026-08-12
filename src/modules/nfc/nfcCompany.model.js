/**
 * NfcCompany — a company in the NFC card platform. Its brand colour and links
 * drive the look of every tap page for its people. Separate from the Client
 * module (M5); its people live in NfcEmployee, its cards in NfcCard.
 */
import mongoose from 'mongoose';

const nfcCompanySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    companyNameAr: { type: String, trim: true, default: null },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    // A ready Google/Apple Maps link; the tap page falls back to a maps search
    // of `address` when this is empty.
    mapLink: { type: String, trim: true },
    city: { type: String, trim: true },
    // Accent colour for this company's tap pages, e.g. "#4F46E5".
    brandColour: { type: String, trim: true, default: '#4F46E5' },
    // Stored logo image filename (served publicly via /nfc-media/<logo>).
    logo: { type: String, default: null },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

nfcCompanySchema.index({ companyName: 1 });

export default mongoose.model('NfcCompany', nfcCompanySchema);
