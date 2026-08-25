/**
 * Attendance routes.
 *
 * Roles: marking is an operational/HR action (Admin, Manager, HR). Reading
 * and exporting are open to any authenticated user — Accounts needs the
 * summary for billing/payroll.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  markBulkSchema,
  listAttendanceSchema,
  summarySchema,
  exportSchema,
  officeLocationSchema,
  createTapPointSchema,
  updateTapPointSchema,
  tapPointIdParamSchema,
} from './attendance.validation.js';
import * as attendanceController from './attendance.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff); // staff-only module; Workers use the ESS portal (P2-M2)

router.post(
  '/bulk',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ body: markBulkSchema }),
  asyncHandler(attendanceController.markBulk)
);
router.get('/', validate({ query: listAttendanceSchema }), asyncHandler(attendanceController.list));
router.get(
  '/summary',
  validate({ query: summarySchema }),
  asyncHandler(attendanceController.summary)
);
router.get(
  '/export',
  validate({ query: exportSchema }),
  asyncHandler(attendanceController.exportSummary)
);

// P2-M3: the geofence Workers' self-marked attendance is checked against.
// Admin-only — it's a security-relevant setting, not a day-to-day action.
router.get('/office-location', requireRoles('Admin'), asyncHandler(attendanceController.getOfficeLocation));
router.patch(
  '/office-location',
  requireRoles('Admin'),
  validate({ body: officeLocationSchema }),
  asyncHandler(attendanceController.updateOfficeLocation)
);

// P2-M3+: physical NFC tap points (e.g. one per room) a Worker taps to sign
// in/out. Admin-only — creating one mints a working URL, same security
// weight as the geofence config.
router.get('/tap-points', requireRoles('Admin'), asyncHandler(attendanceController.listTapPoints));
router.post(
  '/tap-points',
  requireRoles('Admin'),
  validate({ body: createTapPointSchema }),
  asyncHandler(attendanceController.createTapPoint)
);
router.patch(
  '/tap-points/:id',
  requireRoles('Admin'),
  validate({ params: tapPointIdParamSchema, body: updateTapPointSchema }),
  asyncHandler(attendanceController.updateTapPoint)
);
router.post(
  '/tap-points/:id/rotate',
  requireRoles('Admin'),
  validate({ params: tapPointIdParamSchema }),
  asyncHandler(attendanceController.rotateTapPointToken)
);
router.delete(
  '/tap-points/:id',
  requireRoles('Admin'),
  validate({ params: tapPointIdParamSchema }),
  asyncHandler(attendanceController.deleteTapPoint)
);

export default router;
