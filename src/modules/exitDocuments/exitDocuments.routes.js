/**
 * Exit-documents routes (P3-D) — the staff-facing half of both Exit
 * Re-Entry visa requests and Certificate requests. Workers submit their own
 * through /api/me instead (see the `me` module); a staff login submits
 * their own here (`POST /exit-reentry`, `POST /certificates` — the same
 * self-submission gap the Configurable Approval Hierarchy work filled for
 * Leave/Timesheet/SalaryAdvance/Reimbursement).
 *
 * Roles: list/submit/decide are requireStaffOrExecutive, matching Leave —
 * once ApprovalRole membership is decoupled from User.role, an Admin could
 * legitimately put an Accounts or Executive login into a workflow step for
 * either request type; the shared engine (approvalEngine.service.js) is the
 * REAL authorization, this just confirms "some staff member (or Executive)
 * is asking." A request not yet on a workflow still enforces the original
 * Admin/Manager/HR gate itself, inside the engine's legacy path. Marking a
 * request actually issued stays narrower (Admin/Manager/HR only) — that's a
 * separate HR/compliance recording step, not part of the approval chain.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaffOrExecutive } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  submitExitReentrySchema,
  decideExitReentrySchema,
  markIssuedSchema as markExitReentryIssuedSchema,
  listExitReentrySchema,
  exitReentryIdParamSchema,
} from './exitReentry.validation.js';
import {
  submitCertificateSchema,
  decideCertificateSchema,
  listCertificatesSchema,
  certificateIdParamSchema,
} from './certificate.validation.js';
import * as exitReentryController from './exitReentry.controller.js';
import * as certificateController from './certificate.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaffOrExecutive);

router.get('/exit-reentry', validate({ query: listExitReentrySchema }), asyncHandler(exitReentryController.list));
router.post(
  '/exit-reentry',
  validate({ body: submitExitReentrySchema }),
  asyncHandler(exitReentryController.submit)
);
router.patch(
  '/exit-reentry/:id/decide',
  validate({ params: exitReentryIdParamSchema, body: decideExitReentrySchema }),
  asyncHandler(exitReentryController.decide)
);
router.patch(
  '/exit-reentry/:id/issue',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: exitReentryIdParamSchema, body: markExitReentryIssuedSchema }),
  asyncHandler(exitReentryController.markIssued)
);

router.get('/certificates', validate({ query: listCertificatesSchema }), asyncHandler(certificateController.list));
router.post(
  '/certificates',
  validate({ body: submitCertificateSchema }),
  asyncHandler(certificateController.submit)
);
router.get(
  '/certificates/:id/pdf',
  validate({ params: certificateIdParamSchema }),
  asyncHandler(certificateController.pdf)
);
router.patch(
  '/certificates/:id/decide',
  validate({ params: certificateIdParamSchema, body: decideCertificateSchema }),
  asyncHandler(certificateController.decide)
);
router.patch(
  '/certificates/:id/issue',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: certificateIdParamSchema }),
  asyncHandler(certificateController.markIssued)
);

export default router;
