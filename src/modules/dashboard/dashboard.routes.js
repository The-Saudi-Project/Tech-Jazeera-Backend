/**
 * Dashboard route. Read-only, available to any authenticated STAFF user — it's
 * the staff landing page, so a Worker (P2-M1) is excluded (requireStaff);
 * their own landing is the ESS portal (P2-M2). Every figure a Coordinator
 * receives is scoped to their own team by the service, not by this route —
 * see dashboard.service.js's getDashboard() doc comment.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { dashboardQuerySchema } from './dashboard.validation.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireStaff,
  validate({ query: dashboardQuerySchema }),
  asyncHandler(dashboardController.overview)
);

export default router;
