import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { listAuditSchema } from './audit.validation.js';
import * as auditController from './audit.controller.js';

const router = Router();

// The canonical protected-route pattern every module will copy:
// requireAuth (who are you) → requireRoles (may you) → validate → controller.
router.get(
  '/',
  requireAuth,
  requireRoles('Admin'),
  validate({ query: listAuditSchema }),
  asyncHandler(auditController.list)
);

export default router;
