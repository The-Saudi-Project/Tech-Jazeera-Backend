/**
 * JobTitle — the admin-managed picklist behind Mobilisation's "Job title"
 * field (see mobilisations/mobilisation.model.js). Mobilisation stores the
 * chosen title as a plain string snapshot, same "reference at pick-time,
 * snapshot for durable history" rule as clientName/workerName — renaming or
 * deactivating an entry here never rewrites a past mobilisation's own text.
 */
import mongoose from 'mongoose';

const jobTitleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

jobTitleSchema.index({ isActive: 1 });

export default mongoose.model('JobTitle', jobTitleSchema);
