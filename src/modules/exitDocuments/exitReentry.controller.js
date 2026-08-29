/**
 * Exit Re-Entry controller — HTTP translation only. Worker submit/list/
 * cancel live in the `me` module; this is the staff-facing half.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as exitReentryService from './exitReentry.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

export async function list(req, res) {
  const data = await exitReentryService.listExitReentry(req.query);
  res.json(new ApiResponse('Exit re-entry requests.', data));
}

export async function decide(req, res) {
  const request = await exitReentryService.decideExitReentry(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Request ${request.status.toLowerCase()}.`, request));
}

export async function markIssued(req, res) {
  const request = await exitReentryService.markExitReentryIssued(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Marked as issued.', request));
}
