/**
 * Payroll controller — HTTP translation only. The payslip PDF endpoint
 * streams a file, same pattern as quotation/settlement/certificate PDFs.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as payrollService from './payroll.service.js';
import { buildPayslipPdf } from './payroll.pdf.js';
import { getLetterheadData } from '../companySettings/companySettings.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

export async function list(req, res) {
  const data = await payrollService.listPayrollRuns(req.query);
  res.json(new ApiResponse('Payroll runs.', data));
}

export async function get(req, res) {
  const run = await payrollService.getPayrollRun(req.params.id);
  res.json(new ApiResponse('Payroll run.', run));
}

export async function create(req, res) {
  const run = await payrollService.createPayrollRun(req.body, actor(req));
  res.status(201).json(new ApiResponse('Payroll run created.', run));
}

export async function updateLine(req, res) {
  const run = await payrollService.updatePayrollLine(req.params.id, req.params.lineId, req.body, actor(req));
  res.json(new ApiResponse('Payroll line updated.', run));
}

export async function finalize(req, res) {
  const run = await payrollService.finalizePayrollRun(req.params.id, actor(req));
  res.json(new ApiResponse('Payroll run finalized.', run));
}

export async function remove(req, res) {
  await payrollService.deletePayrollRun(req.params.id, actor(req));
  res.json(new ApiResponse('Payroll run deleted.'));
}

/** GET /api/payroll/:id/lines/:lineId/pdf — staff, any employee's payslip. */
export async function pdf(req, res) {
  const resolved = await payrollService.resolvePayslip(req.params.id, req.params.lineId);
  await sendPayslipPdf(resolved, res);
}

export async function sendPayslipPdf({ run, line }, res) {
  const { company, logo } = await getLetterheadData();
  const buffer = await buildPayslipPdf({ run, line }, company, logo);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Payslip-${line.employeeCode}-${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}.pdf"`);
  res.send(buffer);
}
