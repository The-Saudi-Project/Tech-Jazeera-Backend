/**
 * Dashboard controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import { getDashboard } from './dashboard.service.js';

/**
 * GET /api/dashboard?thresholdDays=  — 200 → data: the full rolled-up overview.
 * A Coordinator's expiringDocuments are scoped to their own team (P2-M2);
 * every other figure stays company-wide.
 */
export async function overview(req, res) {
  const data = await getDashboard({
    thresholdDays: req.query.thresholdDays,
    actor: { role: req.user.role, userId: req.user.id },
  });
  res.json(new ApiResponse('Dashboard.', data));
}
