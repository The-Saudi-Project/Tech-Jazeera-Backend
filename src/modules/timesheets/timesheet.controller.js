/**
 * Timesheet controller — HTTP translation only. Worker submit/list live in
 * the `me` module; this is the staff-facing review queue.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as timesheetService from './timesheet.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

export async function list(req, res) {
  const data = await timesheetService.listTimesheets(req.query);
  res.json(new ApiResponse('Timesheets.', data));
}

export async function decide(req, res) {
  const timesheet = await timesheetService.decideTimesheet(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Timesheet ${timesheet.status.toLowerCase()}.`, timesheet));
}

export async function bulkApprove(req, res) {
  const result = await timesheetService.bulkApproveTimesheets(req.body.ids, actor(req));
  res.json(new ApiResponse(`${result.approved} of ${result.requested} timesheet(s) approved.`, result));
}
