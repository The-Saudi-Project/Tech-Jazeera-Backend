/**
 * Reimbursement claim service — submit (with a receipt), decide, mark paid,
 * and resolve the receipt file for download.
 */
import Employee from '../employees/employee.model.js';
import ReimbursementClaim from './reimbursement.model.js';
import ApiError from '../../utils/ApiError.js';
import { signedDownloadUrl, destroyDocumentFile } from '../../middleware/upload.js';
import { logAudit } from '../audit/audit.service.js';

function receiptFromFile(file) {
  return {
    fileName: file.filename, // Cloudinary public_id, set by uploadSingle
    resourceType: 'raw',
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export async function submitReimbursement(employeeId, data, file, actor) {
  if (!file) throw new ApiError(400, 'A receipt file is required.');
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const claim = await ReimbursementClaim.create({
    employee: employeeId,
    ...data,
    receipt: receiptFromFile(file),
  });
  await logAudit({
    user: actor.userId,
    action: 'reimbursement.submit',
    targetType: 'ReimbursementClaim',
    targetId: claim._id,
    meta: { employeeId: employee.employeeId, category: data.category, amount: data.amount },
    ip: actor.ip,
  });
  return claim.toObject();
}

export async function listOwnReimbursements(employeeId, { page, limit, status }) {
  const filter = { employee: employeeId };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    ReimbursementClaim.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ReimbursementClaim.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** A receipt file for its OWN claimant only — used by the /api/me route. */
export async function getMyReceiptFile(employeeId, id) {
  const claim = await ReimbursementClaim.findById(id).lean();
  if (!claim || claim.employee.toString() !== employeeId) {
    throw new ApiError(404, 'Reimbursement claim not found.');
  }
  return resolveReceipt(claim);
}

/** A receipt file for staff review — any claim. */
export async function getReceiptFile(id) {
  const claim = await ReimbursementClaim.findById(id).lean();
  if (!claim) throw new ApiError(404, 'Reimbursement claim not found.');
  return resolveReceipt(claim);
}

function resolveReceipt(claim) {
  return {
    url: signedDownloadUrl(claim.receipt.fileName, claim.receipt.resourceType),
    mimeType: claim.receipt.mimeType,
    originalName: claim.receipt.originalName,
  };
}

export async function cancelReimbursement(employeeId, id, actor) {
  const claim = await ReimbursementClaim.findById(id);
  if (!claim) throw new ApiError(404, 'Reimbursement claim not found.');
  if (claim.employee.toString() !== employeeId) {
    throw new ApiError(403, 'You can only cancel your own reimbursement claims.');
  }
  if (claim.status !== 'Pending') throw new ApiError(400, 'Only a pending claim can be cancelled.');

  await destroyDocumentFile(claim.receipt.fileName, claim.receipt.resourceType).catch(() => {});
  await claim.deleteOne();
  await logAudit({
    user: actor.userId,
    action: 'reimbursement.cancel',
    targetType: 'ReimbursementClaim',
    targetId: claim._id,
    ip: actor.ip,
  });
}

export async function listReimbursements({ page, limit, status, employee }) {
  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  const [items, total] = await Promise.all([
    ReimbursementClaim.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'fullName employeeId')
      .lean(),
    ReimbursementClaim.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function decideReimbursement(id, { status, decisionNote }, actor) {
  const claim = await ReimbursementClaim.findById(id);
  if (!claim) throw new ApiError(404, 'Reimbursement claim not found.');
  if (claim.status !== 'Pending') throw new ApiError(400, 'Only a pending claim can be decided.');

  claim.status = status;
  claim.decidedBy = actor.userId;
  claim.decidedAt = new Date();
  claim.decisionNote = decisionNote;
  await claim.save();

  await logAudit({
    user: actor.userId,
    action: `reimbursement.${status.toLowerCase()}`,
    targetType: 'ReimbursementClaim',
    targetId: claim._id,
    meta: { decisionNote },
    ip: actor.ip,
  });
  return claim.toObject();
}

export async function markReimbursementPaid(id, actor) {
  const claim = await ReimbursementClaim.findById(id);
  if (!claim) throw new ApiError(404, 'Reimbursement claim not found.');
  if (claim.status !== 'Approved') throw new ApiError(400, 'Only an approved claim can be marked paid.');

  claim.status = 'Paid';
  claim.paidAt = new Date();
  claim.paidBy = actor.userId;
  await claim.save();

  await logAudit({
    user: actor.userId,
    action: 'reimbursement.paid',
    targetType: 'ReimbursementClaim',
    targetId: claim._id,
    meta: { amount: claim.amount },
    ip: actor.ip,
  });
  return claim.toObject();
}
