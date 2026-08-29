/**
 * Salary advance controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as advanceService from './advance.service.js';

const actor = (req) => ({ userId: req.user.id, ip: req.ip });

/** GET /api/financial-requests/advances — staff review queue */
export async function list(req, res) {
  const data = await advanceService.listAdvances(req.query);
  res.json(new ApiResponse('Salary advances.', data));
}

/** PATCH /api/financial-requests/advances/:id/decide */
export async function decide(req, res) {
  const advance = await advanceService.decideAdvance(req.params.id, req.body, actor(req));
  res.json(new ApiResponse(`Advance ${advance.status.toLowerCase()}.`, advance));
}

/** POST /api/financial-requests/advances/:id/repayments */
export async function addRepayment(req, res) {
  const advance = await advanceService.addRepayment(req.params.id, req.body, actor(req));
  res.status(201).json(new ApiResponse('Repayment recorded.', advance));
}
