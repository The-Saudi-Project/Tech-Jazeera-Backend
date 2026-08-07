/**
 * Deployment routes.
 *
 * Roles: everyone authenticated may READ the register/history. Assigning,
 * transferring and ending are operational actions owned by Admin / Manager /
 * Operations. There is no DELETE — deployments are immutable history; the
 * "end" action is how an active placement is closed.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  assignSchema,
  transferSchema,
  listDeploymentsSchema,
  deploymentIdParamSchema,
} from './deployment.validation.js';
import * as deploymentController from './deployment.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff); // staff-only module; Workers use the ESS portal (P2-M2)

const canWrite = requireRoles('Admin', 'Manager', 'Operations');

router.get('/', validate({ query: listDeploymentsSchema }), asyncHandler(deploymentController.list));
router.get(
  '/:id',
  validate({ params: deploymentIdParamSchema }),
  asyncHandler(deploymentController.get)
);
router.post('/', canWrite, validate({ body: assignSchema }), asyncHandler(deploymentController.assign));
router.post(
  '/:id/transfer',
  canWrite,
  validate({ params: deploymentIdParamSchema, body: transferSchema }),
  asyncHandler(deploymentController.transfer)
);
router.post(
  '/:id/end',
  canWrite,
  validate({ params: deploymentIdParamSchema }),
  asyncHandler(deploymentController.end)
);

export default router;
