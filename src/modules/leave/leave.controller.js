/**
 * Leave controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as leaveService from './leave.service.js';

const actor = (req) => ({ userId: req.user.id, role: req.user.role, ip: req.ip });

/** GET /api/leave-types — any authenticated user (a Worker needs this to submit). */
export async function listTypes(req, res) {
  const types = await leaveService.listLeaveTypes(req.query);
  res.json(new ApiResponse('Leave types.', types));
}

/** POST /api/leave-types   (Admin, Manager) */
export async function createType(req, res) {
  const type = await leaveService.createLeaveType(req.body, actor(req));
  res.status(201).json(new ApiResponse('Leave type created.', type));
}

/** PATCH /api/leave-types/:id   (Admin, Manager) */
export async function updateType(req, res) {
  const type = await leaveService.updateLeaveType(req.params.id, req.body, actor(req));
  res.json(new ApiResponse('Leave type updated.', type));
}

/** GET /api/leave — staff review queue, scoped to a Coordinator's own team. */
export async function list(req, res) {
  const data = await leaveService.listLeaveRequests(req.query, actor(req));
  res.json(new ApiResponse('Leave requests.', data));
}

/** PATCH /api/leave/:id/decide   (Admin, Manager, HR, Coordinator-own-team) */
export async function decide(req, res) {
  const request = await leaveService.decideLeaveRequest(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Leave request ${request.status.toLowerCase()}.`, request));
}

/** PATCH /api/leave/:id/acknowledge   (Admin, Manager, HR, Coordinator-own-team) */
export async function acknowledge(req, res) {
  const request = await leaveService.acknowledgeLeaveRequest(req.params.id, actor(req));
  res.json(new ApiResponse('Marked as seen.', request));
}
