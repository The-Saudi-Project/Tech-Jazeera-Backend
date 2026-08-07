/**
 * NfcAssignment — the full history of who a card belonged to, and when.
 *
 * One row per assignment. The row with `unassignedAt: null` is the current
 * holder; closing it (setting the date) is how unassign / reassign / lost work.
 * This is what lets a card detail page show "previously assigned to…", not just
 * the current holder.
 */
import mongoose from 'mongoose';

const nfcAssignmentSchema = new mongoose.Schema(
  {
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcCard', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcEmployee', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcCompany', required: true },
    assignedAt: { type: Date, default: () => new Date() },
    unassignedAt: { type: Date, default: null }, // null = still the current holder
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

nfcAssignmentSchema.index({ card: 1, assignedAt: -1 });

export default mongoose.model('NfcAssignment', nfcAssignmentSchema);
