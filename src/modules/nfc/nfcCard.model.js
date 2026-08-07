/**
 * NfcCard — one physical card, the heart of the platform's inventory.
 *
 * Its `token` is the random 12-char string in the public URL (/c/<token>); the
 * chip is written with that URL. A card moves through statuses over its life and
 * points at (at most) one person at a time. The public page resolves ONLY when a
 * card is `active` and linked to a person; every other state 404s identically.
 */
import mongoose from 'mongoose';

export const NFC_CARD_STATUSES = ['unassigned', 'active', 'lost', 'returned', 'disabled'];

const nfcCardSchema = new mongoose.Schema(
  {
    // The public token; unique and indexed for the O(1) public lookup.
    token: { type: String, required: true, unique: true },
    // The chip's hardware UID (optional, filled when the chip is written).
    chipUid: { type: String, trim: true, default: null },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcBatch', default: null, index: true },
    status: { type: String, enum: NFC_CARD_STATUSES, default: 'unassigned', index: true },
    // Current holder (denormalized company for quick admin filtering). Null when
    // unassigned/returned/disabled. History lives in NfcAssignment.
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcEmployee', default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcCompany', default: null, index: true },
    assignedAt: { type: Date, default: null },
    issuedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// A chip UID is unique per physical chip — but optional, so only enforce it on
// real (string) values.
nfcCardSchema.index(
  { chipUid: 1 },
  { unique: true, partialFilterExpression: { chipUid: { $type: 'string' } } }
);

export default mongoose.model('NfcCard', nfcCardSchema);
