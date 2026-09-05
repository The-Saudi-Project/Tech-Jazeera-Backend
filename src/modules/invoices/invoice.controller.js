/**
 * Invoice controller — HTTP translation. The PDF endpoint streams a file,
 * same pattern as the quotation PDF.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as invoiceService from './invoice.service.js';
import { buildInvoicePdf } from './invoice.pdf.js';
import { getLetterheadData } from '../companySettings/companySettings.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

export async function list(req, res) {
  const data = await invoiceService.listInvoices(req.query);
  res.json(new ApiResponse('Invoices.', data));
}

export async function get(req, res) {
  const invoice = await invoiceService.getInvoice(req.params.id);
  res.json(new ApiResponse('Invoice.', invoice));
}

export async function create(req, res) {
  const invoice = await invoiceService.createInvoice(req.body, actor(req));
  res.status(201).json(new ApiResponse('Invoice created.', invoice));
}

export async function recordPayment(req, res) {
  const invoice = await invoiceService.recordPayment(req.params.id, req.body, actor(req));
  res.status(201).json(new ApiResponse(`Payment recorded — invoice ${invoice.status.toLowerCase()}.`, invoice));
}

export async function remove(req, res) {
  await invoiceService.deleteInvoice(req.params.id, actor(req));
  res.json(new ApiResponse('Invoice deleted.'));
}

export async function pdf(req, res) {
  const invoice = await invoiceService.getInvoice(req.params.id);
  const { company, logo } = await getLetterheadData();
  const buffer = await buildInvoicePdf(invoice, company, logo);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(buffer);
}
