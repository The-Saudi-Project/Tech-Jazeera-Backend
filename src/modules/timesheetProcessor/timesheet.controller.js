/**
 * Timesheet controller — HTTP translation only.
 *
 * `preview` returns the standard JSON envelope; `export` intentionally breaks it
 * to stream a binary .xlsx with download headers (the documented exception, same
 * as the attendance export).
 */
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import { logAudit } from '../audit/audit.service.js';
import { getCompanySettings } from '../companySettings/companySettings.service.js';
import * as timesheetService from './timesheet.service.js';
import { buildTimesheetXlsx } from './timesheet.export.js';
import { XLSX_MIME } from './timesheet.constants.js';

/**
 * Fetch the configured company logo's actual bytes for embedding (exceljs
 * needs a buffer, not a URL). Uploaded as PNG unconditionally (see
 * logo.upload.js), so the extension is always known. Returns null — never
 * throws — if no logo is configured, or if the fetch fails: a transient
 * Cloudinary hiccup should degrade to "no logo" on this export, not block
 * someone from getting a payroll-critical timesheet out.
 */
async function fetchLogo() {
  const settings = await getCompanySettings();
  if (!settings.logoUrl) return null;
  try {
    const upstream = await fetch(settings.logoUrl);
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    return { buffer: Buffer.from(await upstream.arrayBuffer()), extension: 'png' };
  } catch (err) {
    logger.warn(`[timesheet-processor] failed to fetch company logo for export: ${err.message}`);
    return null;
  }
}

/** Guard: multer must have attached a buffer. Friendlier than the parser's. */
function requireFile(req) {
  if (!req.file || !req.file.buffer) {
    throw new ApiError(400, 'Please attach an Excel (.xlsx) file to process.');
  }
}

/**
 * POST /api/timesheet-processor/preview   (Admin)
 * multipart: file + { employeeId, month, year, requiredMinutes? }
 * 200 → data: { employee, month, year, monthName, requiredMinutes, rows, summary, warnings }
 */
export async function preview(req, res) {
  requireFile(req);
  const result = await timesheetService.processTimesheet({ buffer: req.file.buffer, ...req.body });
  res.json(new ApiResponse('Timesheet processed.', result));
}

/**
 * POST /api/timesheet-processor/export   (Admin)
 * Same inputs; recomputes server-side and streams a formatted .xlsx.
 */
export async function exportXlsx(req, res) {
  requireFile(req);
  const result = await timesheetService.processTimesheet({ buffer: req.file.buffer, ...req.body });
  const logo = await fetchLogo();
  const buffer = await buildTimesheetXlsx(result, logo);

  await logAudit({
    user: req.user.id,
    action: 'timesheet.export',
    targetType: 'Employee',
    targetId: result.employee.id,
    meta: { month: result.month, year: result.year },
    ip: req.ip,
  });

  const filename = `timesheet_${result.employee.employeeId}_${result.year}-${String(result.month).padStart(2, '0')}.xlsx`;
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}
