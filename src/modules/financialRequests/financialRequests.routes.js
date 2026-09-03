/**
 * Financial requests routes (P3-C). Workers submit their own advance/
 * reimbursement requests through /api/me instead; this router is the staff
 * review queue plus the actions staff perform (submit their OWN request,
 * decide, record a repayment, mark paid).
 *
 * Roles: the review queue (list) and decide are Admin/Manager/HR/Accounts
 * READ, Admin/Manager/HR/Accounts... see below — Coordinator was
 * deliberately excluded from ALL of this by the original design (money
 * matters kept in a narrower circle than Leave). The Approval Hierarchy's
 * staff self-submission (P2-M4+) reopens exactly two doors for Coordinator:
 * submitting their own request, and then seeing ONLY that request in the
 * list (see advance.service.js/reimbursement.service.js's Coordinator
 * self-scoping) — never the company-wide queue. Deciding is requireStaff
 * because the shared approvalEngine is the REAL gate once a workflow
 * governs a request (see approvalEngine.service.js); the legacy (no
 * workflow) path still enforces the original Admin/Manager/HR-only rule
 * itself. Recording money actually changing hands (a repayment, marking a
 * claim paid) is untouched — never part of "deciding," so it keeps its
 * original Admin/Manager/HR/Accounts-only gate.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import logger from '../../config/logger.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingle, destroyDocumentFile } from '../../middleware/upload.js';
import {
  submitAdvanceSchema,
  decideAdvanceSchema,
  addRepaymentSchema,
  listAdvancesSchema,
  advanceIdParamSchema,
} from './advance.validation.js';
import {
  submitReimbursementSchema,
  decideReimbursementSchema,
  listReimbursementsSchema,
  reimbursementIdParamSchema,
} from './reimbursement.validation.js';
import * as advanceController from './advance.controller.js';
import * as reimbursementController from './reimbursement.controller.js';

const router = Router();

router.use(requireAuth);

const canHandleMoney = requireRoles('Admin', 'Manager', 'HR', 'Accounts');

router.get(
  '/advances',
  requireStaff,
  validate({ query: listAdvancesSchema }),
  asyncHandler(advanceController.list)
);
router.post(
  '/advances',
  requireStaff,
  validate({ body: submitAdvanceSchema }),
  asyncHandler(advanceController.submit)
);
router.patch(
  '/advances/:id/decide',
  requireStaff,
  validate({ params: advanceIdParamSchema, body: decideAdvanceSchema }),
  asyncHandler(advanceController.decide)
);
router.post(
  '/advances/:id/repayments',
  canHandleMoney,
  validate({ params: advanceIdParamSchema, body: addRepaymentSchema }),
  asyncHandler(advanceController.addRepayment)
);

router.get(
  '/reimbursements',
  requireStaff,
  validate({ query: listReimbursementsSchema }),
  asyncHandler(reimbursementController.list)
);
router.post(
  '/reimbursements',
  requireStaff,
  uploadSingle,
  validate({ body: submitReimbursementSchema }),
  asyncHandler(reimbursementController.submit)
);
// NOT widened to requireStaff: getReceiptFile() has no per-claim ownership
// scoping (any id fetches any receipt), so keeping this at the ORIGINAL
// review-circle-only gate is a deliberate security choice, not an oversight
// — a Coordinator viewing their own receipt again post-submission is a
// minor UX gap, not worth opening every claim's receipt to every staff role.
router.get(
  '/reimbursements/:id/receipt',
  canHandleMoney,
  validate({ params: reimbursementIdParamSchema }),
  asyncHandler(reimbursementController.receipt)
);
router.patch(
  '/reimbursements/:id/decide',
  requireStaff,
  validate({ params: reimbursementIdParamSchema, body: decideReimbursementSchema }),
  asyncHandler(reimbursementController.decide)
);
router.patch(
  '/reimbursements/:id/pay',
  canHandleMoney,
  validate({ params: reimbursementIdParamSchema }),
  asyncHandler(reimbursementController.markPaid)
);

/** Same orphaned-upload cleanup as me.routes.js/document.routes.js — only
 *  the reimbursement POST above ever sets req.file on this router. */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (req.file?.filename) {
    destroyDocumentFile(req.file.filename).catch((cleanupErr) =>
      logger.error(`[financial-requests] orphaned receipt upload ${req.file.filename}: ${cleanupErr.message}`)
    );
  }
  next(err);
});

export default router;
