/**
 * Timesheet controller — HTTP translation only. Worker submit/list live in
 * the `me` module; this is the staff-facing review queue, plus a STAFF
 * member submitting their OWN timesheet (Coordinator/HR/Manager/Accounts).
 */
import ApiError from '../../utils/ApiError.js';
import ApiResponse from '../../utils/ApiResponse.js';
import * as timesheetService from './timesheet.service.js';

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
