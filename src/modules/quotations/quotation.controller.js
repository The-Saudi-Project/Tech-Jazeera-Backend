/**
 * Quotation controller — HTTP translation. The PDF endpoint streams a file
 * (not the JSON envelope), like the attendance export.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as quotationService from './quotation.service.js';
import { buildQuotationPdf } from './quotation.pdf.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** GET /api/quotations — 200 → data: { items, total, page, pages } */
export async function list(req, res) {
  const data = await quotationService.listQuotations(req.query);
  res.json(new ApiResponse('Quotations.', data));
}

/** GET /api/quotations/:id — 200 → data: quotation */
export async function get(req, res) {
  const quotation = await quotationService.getQuotation(req.params.id);
  res.json(new ApiResponse('Quotation.', quotation));
}

/** POST /api/quotations — 201 → data: quotation (totals computed server-side) */
export async function create(req, res) {
  const quotation = await quotationService.createQuotation(req.body, actor(req));
  res.status(201).json(new ApiResponse('Quotation created.', quotation));
}

/** PATCH /api/quotations/:id — 200 → data: quotation */
export async function update(req, res) {
  const quotation = await quotationService.updateQuotation(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Quotation updated.', quotation));
}

/** POST /api/quotations/:id/duplicate — 201 → data: new Draft quotation */
export async function duplicate(req, res) {
  const quotation = await quotationService.duplicateQuotation(req.params.id, actor(req));
  res.status(201).json(new ApiResponse('Quotation duplicated.', quotation));
}

/** DELETE /api/quotations/:id — 200 → data: null */
export async function remove(req, res) {
  await quotationService.deleteQuotation(req.params.id, actor(req));
  res.json(new ApiResponse('Quotation deleted.'));
}

/** GET /api/quotations/:id/pdf — downloads the quotation as a PDF. */
export async function pdf(req, res) {
  const quotation = await quotationService.getQuotation(req.params.id);
  const buffer = await buildQuotationPdf(quotation);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quotation.quotationNumber}.pdf"`);
  res.send(buffer);
}
