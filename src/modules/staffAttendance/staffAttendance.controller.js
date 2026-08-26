/**
 * Staff self-attendance controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as staffAttendanceService from './staffAttendance.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/**
 * POST /api/staff-attendance/punch — 200 → data: { action, record }
 * Same first-punch-checks-in, later-punch-pushes-checkout-forward semantics
 * as a Worker's punch. 403 if outside the geofence/office network.
 */
export async function punch(req, res) {
  const data = await staffAttendanceService.selfPunch(req.body, actor(req));
  res.json(new ApiResponse(data.action === 'checked-in' ? 'Signed in.' : 'Recorded.', data));
}

/** GET /api/staff-attendance — 200 → data: record[] (last 30 days by default) */
export async function listMine(req, res) {
  const data = await staffAttendanceService.listMyAttendance(actor(req), req.query);
  res.json(new ApiResponse('Your attendance.', data));
}
