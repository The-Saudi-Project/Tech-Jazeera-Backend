/**
 * Staff self-attendance controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as staffAttendanceService from './staffAttendance.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/**
 * POST /api/staff-attendance/punch — 200 → data: { action, record }
 * A strict per-day toggle — signed in and not yet out → this signs OUT;
 * anything else → this signs IN fresh. 403 if outside the geofence/office network.
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

/**
 * GET /api/staff-attendance/all   (Admin, Manager, HR)
 * 200 → data: record[] — everyone's self-marked attendance over the range,
 * not just the caller's own.
 */
export async function listAll(req, res) {
  const data = await staffAttendanceService.listAllAttendance(req.query);
  res.json(new ApiResponse('Staff attendance.', data));
}
