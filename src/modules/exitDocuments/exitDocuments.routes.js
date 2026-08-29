/**
 * Exit-documents routes (P3-D) — the staff-facing half of both Exit
 * Re-Entry visa requests and Certificate requests. Workers submit their own
 * through /api/me instead (see the `me` module).
 *
 * Roles: Admin/Manager/HR decide and mark issued — both are HR/compliance
 * actions (visa paperwork, official letters), not something Accounts needs
 * to touch (unlike the financial requests module).
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  decideExitReentrySchema,
  markIssuedSchema as markExitReentryIssuedSchema,
  listExitReentrySchema,
  exitReentryIdParamSchema,
} from './exitReentry.validation.js';
import { decideCertificateSchema, listCertificatesSchema, certificateIdParamSchema } from './certificate.validation.js';
import * as exitReentryController from './exitReentry.controller.js';
import * as certificateController from './certificate.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireRoles('Admin', 'Manager', 'HR'));

router.get('/exit-reentry', validate({ query: listExitReentrySchema }), asyncHandler(exitReentryController.list));
router.patch(
  '/exit-reentry/:id/decide',
  validate({ params: exitReentryIdParamSchema, body: decideExitReentrySchema }),
  asyncHandler(exitReentryController.decide)
);
router.patch(
  '/exit-reentry/:id/issue',
  validate({ params: exitReentryIdParamSchema, body: markExitReentryIssuedSchema }),
  asyncHandler(exitReentryController.markIssued)
);

router.get('/certificates', validate({ query: listCertificatesSchema }), asyncHandler(certificateController.list));
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
  validate({ params: certificateIdParamSchema }),
  asyncHandler(certificateController.markIssued)
);

export default router;
