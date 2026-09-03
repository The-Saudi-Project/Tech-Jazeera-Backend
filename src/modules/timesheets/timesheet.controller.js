/**
 * Timesheet controller — HTTP translation only. Worker submit/list live in
 * the `me` module; this is the staff-facing review queue, plus a STAFF
 * member submitting their OWN timesheet (Coordinator/HR/Manager/Accounts).
 */
import ApiError from '../../utils/ApiError.js';
import ApiResponse from '../../utils/ApiResponse.js';
import Employee from '../employees/employee.model.js';
import { isApprovalRoleMember } from '../approvals/approvals.service.js';
import { getLogoForEmbedding } from '../companySettings/companySettings.service.js';
import { buildTimesheetXlsx } from '../timesheetProcessor/timesheet.export.js';
import { XLSX_MIME } from '../timesheetProcessor/timesheet.constants.js';
import { logAudit } from '../audit/audit.service.js';
import * as timesheetService from './timesheet.service.js';
import { buildMonthlyAttendanceReport } from './monthlyReport.service.js';

const actor = (req) => ({ userId: req.user.id, role: req.user.role, employee: req.user.employee, ip: req.ip });

export async function list(req, res) {
  const data = await timesheetService.listTimesheets(req.query, actor(req));
  res.json(new ApiResponse('Timesheets.', data));
}

/** POST /api/timesheets — Admin has no Employee record. */
export async function submit(req, res) {
  if (!req.user.employee) {
    throw new ApiError(
      400,
      'Your account has no linked employee record, so there is nothing to submit a personal request against.'
    );
  }
  const timesheet = await timesheetService.submitTimesheet(req.user.employee, req.body, actor(req));
  res.status(201).json(new ApiResponse('Timesheet submitted.', timesheet));
}

export async function decide(req, res) {
  const timesheet = await timesheetService.decideTimesheet(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Timesheet ${timesheet.status.toLowerCase()}.`, timesheet));
}

export async function bulkApprove(req, res) {
  const result = await timesheetService.bulkApproveTimesheets(req.body.ids, actor(req));
  res.json(new ApiResponse(`${result.approved} of ${result.requested} timesheet(s) approved.`, result));
}

/**
 * POST /api/timesheets/monthly-report — a full day-by-day monthly report
 * built from real Attendance records (phone self-punch or staff-marked),
 * in the exact same visual format as the Timesheet Processor's export (see
 * monthlyReport.service.js). Gated beyond the router's own requireStaff:
 * Admin, or anyone the Admin has put into a real Approval Role — the same
 * dynamic, DB-checked "sits somewhere in the hierarchy" rule the Approval
 * Log uses, not a fixed list of login roles. A plain 403 for anyone else,
 * same as the Approval Log's own error state.
 */
export async function generateMonthlyReport(req, res) {
  const isEligible = req.user.role === 'Admin' || (await isApprovalRoleMember(req.user.id));
  if (!isEligible) {
    throw new ApiError(403, 'You are not part of any approval role.');
  }

  const { employeeId, month, year } = req.body;
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const result = await buildMonthlyAttendanceReport(employee, { month, year });
  const logo = await getLogoForEmbedding();
  const buffer = await buildTimesheetXlsx(result, logo);

  await logAudit({
    user: req.user.id,
    action: 'timesheet.monthlyReport.generate',
    targetType: 'Employee',
    targetId: employee._id,
    meta: { month, year },
    ip: req.ip,
  });

  const filename = `timesheet-report_${employee.employeeId}_${year}-${String(month).padStart(2, '0')}.xlsx`;
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}
