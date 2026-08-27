/**
 * Staff self-attendance routes.
 *
 * Self-service (punch, own history) is Coordinator/HR/Accounts only — Admin
 * and Manager are exempt from personal clock-in by design; Workers already
 * have their own equivalent via Employee-based Attendance + the ESS portal.
 * Both resolve against req.user.id, never a client-supplied user id — same
 * self-service guarantee as the /api/me module for Workers.
 *
 * Oversight (GET /all — everyone's attendance, not just your own) is
 * Admin/Manager/HR — the same circle that already sees the Employee-based
 * Records/Summary/Sign-In-Out views, so this data isn't only visible to the
 * people generating it.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { selfMarkSchema, listMyAttendanceSchema } from '../attendance/attendance.validation.js';
import { listAllStaffAttendanceSchema } from './staffAttendance.validation.js';
import * as staffAttendanceController from './staffAttendance.controller.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/punch',
  requireRoles('Coordinator', 'HR', 'Accounts'),
  validate({ body: selfMarkSchema }),
  asyncHandler(staffAttendanceController.punch)
);
router.get(
  '/all',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ query: listAllStaffAttendanceSchema }),
  asyncHandler(staffAttendanceController.listAll)
);
router.get(
  '/',
  requireRoles('Coordinator', 'HR', 'Accounts'),
  validate({ query: listMyAttendanceSchema }),
  asyncHandler(staffAttendanceController.listMine)
);

export default router;
