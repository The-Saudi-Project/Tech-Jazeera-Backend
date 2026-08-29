/**
 * ReimbursementClaim — a worker's own expense claim with a receipt (PRD
 * Module 4). The receipt is a single embedded file, deliberately NOT stored
 * through the Documents module: Documents is a staff-managed compliance
 * archive (Admin/Manager/HR write-gated — passport, iqama, visa); a
 * worker-submitted receipt is a different trust category, so this module
 * owns its own minimal file record instead of punching a worker-upload hole
 * into Documents' RBAC. It reuses the same generic Cloudinary upload
 * middleware (middleware/upload.js), just not the Document model.
 *
 * Paid separately from Decided: approval says the claim is legitimate;
 * "Paid" is Accounts actually reimbursing it, which may happen days later.
 */
import mongoose from 'mongoose';

export const REIMBURSEMENT_CATEGORIES = ['Travel', 'Fuel', 'Meals', 'Medical', 'Tools', 'Other'];
export const REIMBURSEMENT_STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'];

/** The stored receipt file. _id disabled — a value object, not an entity. */
const receiptSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true }, // Cloudinary public_id
    resourceType: { type: String, required: true }, // 'raw', from the upload middleware
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const reimbursementSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    category: { type: String, enum: REIMBURSEMENT_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    receipt: { type: receiptSchema, required: true },

    status: { type: String, enum: REIMBURSEMENT_STATUSES, default: 'Pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500 },

    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

reimbursementSchema.index({ employee: 1, createdAt: -1 });
reimbursementSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ReimbursementClaim', reimbursementSchema);
