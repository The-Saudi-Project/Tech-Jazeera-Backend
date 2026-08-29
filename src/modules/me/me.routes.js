/**
 * "Me" routes — the ESS portal's entire API surface (P2-M2). Worker-only:
 * staff use the full admin modules instead. Every route resolves data
 * against req.user.employee, never a client-supplied employee id.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import logger from '../../config/logger.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingle, destroyDocumentFile } from '../../middleware/upload.js';
import { documentIdParamSchema, fileQuerySchema } from '../documents/document.validation.js';
import {
  submitLeaveRequestSchema,
  listMyLeaveRequestsSchema,
  leaveRequestIdParamSchema,
} from '../leave/leave.validation.js';
import { selfMarkSchema, listMyAttendanceSchema } from '../attendance/attendance.validation.js';
import { submitAdvanceSchema, listMyAdvancesSchema, advanceIdParamSchema } from '../financialRequests/advance.validation.js';
import {
  submitReimbursementSchema,
  listMyReimbursementsSchema,
  reimbursementIdParamSchema,
} from '../financialRequests/reimbursement.validation.js';
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
  '/attendance/punch',
  validate({ body: selfMarkSchema }),
  asyncHandler(meController.punch)
);
router.get(
  '/attendance',
  validate({ query: listMyAttendanceSchema }),
  asyncHandler(meController.listAttendance)
);

router.get('/advances', validate({ query: listMyAdvancesSchema }), asyncHandler(meController.listAdvances));
router.post('/advances', validate({ body: submitAdvanceSchema }), asyncHandler(meController.submitAdvance));
router.patch(
  '/advances/:id/cancel',
  validate({ params: advanceIdParamSchema }),
  asyncHandler(meController.cancelAdvance)
);

router.get(
  '/reimbursements',
  validate({ query: listMyReimbursementsSchema }),
  asyncHandler(meController.listReimbursements)
);
router.post(
  '/reimbursements',
  uploadSingle,
  validate({ body: submitReimbursementSchema }),
  asyncHandler(meController.submitReimbursement)
);
router.get(
  '/reimbursements/:id/receipt',
  validate({ params: reimbursementIdParamSchema }),
  asyncHandler(meController.reimbursementReceipt)
);
router.patch(
  '/reimbursements/:id/cancel',
  validate({ params: reimbursementIdParamSchema }),
  asyncHandler(meController.cancelReimbursement)
);

/** Same orphaned-upload cleanup as document.routes.js — only the
 *  reimbursement POST above ever sets req.file on this router. */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (req.file?.filename) {
    destroyDocumentFile(req.file.filename).catch((cleanupErr) =>
      logger.error(`[me] orphaned receipt upload ${req.file.filename}: ${cleanupErr.message}`)
    );
  }
  next(err);
});

export default router;
