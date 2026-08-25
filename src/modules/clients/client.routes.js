/**
 * Client routes.
 *
 * Role design: everyone authenticated may READ (accounts, managers all
 * need to look clients up). WRITE is Admin/Manager (they own the client
 * relationship and its sites). DELETE is Admin/Manager only — it is
 * destructive and also guarded against clients with assigned workers.
 * Setting status = Inactive is the everyday alternative to deletion.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
  clientIdParamSchema,
} from './client.validation.js';
import * as clientController from './client.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff); // staff-only module; Workers use the ESS portal (P2-M2)

router.get('/', validate({ query: listClientsSchema }), asyncHandler(clientController.list));
router.get('/:id', validate({ params: clientIdParamSchema }), asyncHandler(clientController.get));
router.post(
  '/',
  requireRoles('Admin', 'Manager'),
  validate({ body: createClientSchema }),
  asyncHandler(clientController.create)
);
router.patch(
  '/:id',
  requireRoles('Admin', 'Manager'),
  validate({ params: clientIdParamSchema, body: updateClientSchema }),
  asyncHandler(clientController.update)
);
router.delete(
  '/:id',
  requireRoles('Admin', 'Manager'),
  validate({ params: clientIdParamSchema }),
  asyncHandler(clientController.remove)
);

export default router;
