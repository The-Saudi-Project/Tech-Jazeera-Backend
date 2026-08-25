/**
 * "Me" routes — the ESS portal's entire API surface (P2-M2). Worker-only:
 * staff use the full admin modules instead. Every route resolves data
 * against req.user.employee, never a client-supplied employee id.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { documentIdParamSchema, fileQuerySchema } from '../documents/document.validation.js';
import {
  submitLeaveRequestSchema,
  listMyLeaveRequestsSchema,
  leaveRequestIdParamSchema,
} from '../leave/leave.validation.js';
import { selfMarkSchema, listMyAttendanceSchema } from '../attendance/attendance.validation.js';
import * as meController from './me.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('Worker'));

router.get('/', asyncHandler(meController.getProfile));
router.get('/documents', asyncHandler(meController.listDocuments));
router.get(
  '/documents/:id/file',
  validate({ params: documentIdParamSchema, query: fileQuerySchema }),
  asyncHandler(meController.documentFile)
);
router.get('/leave', validate({ query: listMyLeaveRequestsSchema }), asyncHandler(meController.listLeave));
router.post('/leave', validate({ body: submitLeaveRequestSchema }), asyncHandler(meController.submitLeave));
router.patch(
  '/leave/:id/cancel',
  validate({ params: leaveRequestIdParamSchema }),
  asyncHandler(meController.cancelLeave)
);

router.post(
  '/attendance',
  validate({ body: selfMarkSchema }),
  asyncHandler(meController.markAttendance)
);
router.get(
  '/attendance',
  validate({ query: listMyAttendanceSchema }),
  asyncHandler(meController.listAttendance)
);

export default router;
