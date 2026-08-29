/**
 * Certificate request controller — HTTP translation only. The PDF endpoint
 * streams a file, same pattern as the quotation/settlement PDFs.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as certificateService from './certificate.service.js';
import { buildSalaryCertificatePdf, buildServiceCertificatePdf } from './certificate.pdf.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

const BUILDERS = {
  SalaryCertificate: buildSalaryCertificatePdf,
  ServiceCertificate: buildServiceCertificatePdf,
};

export async function list(req, res) {
  const data = await certificateService.listCertificates(req.query);
  res.json(new ApiResponse('Certificate requests.', data));
}

export async function decide(req, res) {
  const request = await certificateService.decideCertificate(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Request ${request.status.toLowerCase()}.`, request));
}

export async function markIssued(req, res) {
  const request = await certificateService.markCertificateIssued(req.params.id, actor(req));
  res.json(new ApiResponse('Marked as issued.', request));
}

/** GET /api/exit-documents/certificates/:id/pdf — staff, any employee's request. */
export async function pdf(req, res) {
  const resolved = await certificateService.resolveCertificateForPdf(req.params.id);
  await sendCertificatePdf(resolved, res);
}

export async function sendCertificatePdf({ request, employee, exitDate }, res) {
  const buffer = await BUILDERS[request.type]({ employee, request, exitDate });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${request.type}-${employee.employeeId}.pdf"`);
  res.send(buffer);
}
