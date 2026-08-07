/**
 * NfcBatch — a run of blank cards generated together. Lets you write a stack of
 * chips in one sitting and export just that batch's URLs. Cards reference their
 * batch; the batch keeps a label, note, and how many it created.
 */
import mongoose from 'mongoose';

const nfcBatchSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: '' },
    note: { type: String, trim: true },
    count: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

nfcBatchSchema.index({ createdAt: -1 });

export default mongoose.model('NfcBatch', nfcBatchSchema);
