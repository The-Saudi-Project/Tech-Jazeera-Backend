/**
 * Dashboard route. Read-only, available to any authenticated STAFF user — it's
 * the staff landing page and aggregates company-wide figures, so a Worker
 * (P2-M1) is excluded (requireStaff); their own landing is the ESS portal
 * (P2-M2). (A production deployment might further restrict the finance figures
 * to managers; Phase 1 keeps the overview open to all signed-in staff.)
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireStaff } from '../../middleware/rbac.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

router.get('/', requireAuth, requireStaff, asyncHandler(dashboardController.overview));

export default router;
