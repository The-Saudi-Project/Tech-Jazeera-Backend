/**
 * Staff self-attendance routes — Coordinator/HR/Accounts only. Admin and
 * Manager are exempt from personal clock-in by design; Workers already have
 * their own equivalent via Employee-based Attendance + the ESS portal. Every
 * route resolves against req.user.id, never a client-supplied user id — same
 * self-service guarantee as the /api/me module for Workers.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { selfMarkSchema, listMyAttendanceSchema } from '../attendance/attendance.validation.js';
import * as staffAttendanceController from './staffAttendance.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('Coordinator', 'HR', 'Accounts'));

router.post('/punch', validate({ body: selfMarkSchema }), asyncHandler(staffAttendanceController.punch));
router.get('/', validate({ query: listMyAttendanceSchema }), asyncHandler(staffAttendanceController.listMine));

export default router;
