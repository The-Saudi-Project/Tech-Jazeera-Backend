/**
 * Asset — a physical company item (vehicle, laptop, phone, tool) that can be
 * assigned to an employee (PRD Module 6). `currentEmployee` is a denormalized
 * fast-read field, exactly like Employee.currentClient/currentSite — the real
 * source of truth for WHO HAD IT WHEN is the separate AssetAssignment
 * collection (assetAssignment.model.js), same relationship Deployment has to
 * Employee.currentClient.
 */
import mongoose from 'mongoose';

export const ASSET_CATEGORIES = ['Vehicle', 'Laptop', 'Mobile Device', 'Tool', 'Other'];
export const ASSET_STATUSES = ['Available', 'Assigned', 'Maintenance', 'Retired'];

const assetSchema = new mongoose.Schema(
  {
    assetTag: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ASSET_CATEGORIES, required: true },
    status: { type: String, enum: ASSET_STATUSES, default: 'Available' },
    // Managed by the assign/return workflow — never set directly via the edit form.
    currentEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    purchaseDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

assetSchema.index({ category: 1 });
assetSchema.index({ status: 1 });

export default mongoose.model('Asset', assetSchema);
