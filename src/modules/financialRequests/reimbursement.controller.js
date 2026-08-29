/**
 * Reimbursement claim controller — HTTP translation only. The receipt
 * endpoint streams bytes (not the JSON envelope), same pattern as documents.
 */
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ApiError from '../../utils/ApiError.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { contentDisposition } from '../../utils/contentDisposition.js';
import * as reimbursementService from './reimbursement.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** GET /api/financial-requests/reimbursements — staff review queue */
export async function list(req, res) {
  const data = await reimbursementService.listReimbursements(req.query);
  res.json(new ApiResponse('Reimbursement claims.', data));
}

/** GET /api/financial-requests/reimbursements/:id/receipt — streams the receipt. */
export async function receipt(req, res) {
  const fileData = await reimbursementService.getReceiptFile(req.params.id);
  await streamReceipt(fileData, res);
}

/** PATCH /api/financial-requests/reimbursements/:id/decide */
export async function decide(req, res) {
  const claim = await reimbursementService.decideReimbursement(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Claim ${claim.status.toLowerCase()}.`, claim));
}

/** PATCH /api/financial-requests/reimbursements/:id/pay */
export async function markPaid(req, res) {
  const claim = await reimbursementService.markReimbursementPaid(req.params.id, actor(req));
  res.json(new ApiResponse('Claim marked paid.', claim));
}

export async function streamReceipt(fileData, res) {
  res.setHeader('Content-Type', fileData.mimeType);
  res.setHeader('Content-Disposition', contentDisposition(fileData.originalName));
  const upstream = await fetch(fileData.url);
  if (!upstream.ok || !upstream.body) {
    throw new ApiError(410, 'The stored receipt is no longer available.');
  }
  await pipeline(Readable.fromWeb(upstream.body), res);
}
