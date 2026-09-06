/**
 * Exit Re-Entry controller — HTTP translation only. Worker submit/list/
 * cancel live in the `me` module; `submit` here is the staff self-submission
 * counterpart (a Manager/HR/Accounts/Coordinator/Executive login submitting
 * their OWN request — see exitDocuments.routes.js).
 */
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import * as exitReentryService from './exitReentry.service.js';

const actor = (req) => ({ userId: req.user.id, role: req.user.role, ip: req.ip });

/** POST /api/exit-documents/exit-reentry — a staff member's own request. */
export async function submit(req, res) {
  if (!req.user.employee) {
    throw new ApiError(
      400,
      'Your account has no linked employee record, so there is nothing to submit a personal request against.'
    );
  }
  const request = await exitReentryService.submitExitReentry(req.user.employee, req.body, actor(req));
  res.status(201).json(new ApiResponse('Exit re-entry request submitted.', request));
}

export async function list(req, res) {
  const data = await exitReentryService.listExitReentry(req.query, actor(req));
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
