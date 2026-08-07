/**
 * Dashboard controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import { getDashboard } from './dashboard.service.js';

/** GET /api/dashboard — 200 → data: the full rolled-up overview. */
export async function overview(req, res) {
  const data = await getDashboard();
  res.json(new ApiResponse('Dashboard.', data));
}
