/**
 * Staff-user routes (P2-M2).
 *
 * Role design: only Admin creates/edits staff logins — account provisioning
 * is the smallest, most sensitive circle in the app. Manager and HR may LIST
 * (Manager to pick a coordinator's manager and see their team's roster; HR
 * because they assign an employee's coordinator from the employee form and
 * need the Coordinator list to populate that picker) but not create or edit.
 * Every route is staff-only by definition (it manages staff accounts), so
 * requireStaff isn't needed on top of the explicit roles.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createStaffUserSchema,
  updateStaffUserSchema,
  listStaffUsersSchema,
  userIdParamSchema,
} from './user.validation.js';
import * as userController from './user.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ query: listStaffUsersSchema }),
  asyncHandler(userController.list)
);
router.post(
  '/',
  requireRoles('Admin'),
  validate({ body: createStaffUserSchema }),
  asyncHandler(userController.create)
);
router.patch(
  '/:id',
  requireRoles('Admin'),
  validate({ params: userIdParamSchema, body: updateStaffUserSchema }),
  asyncHandler(userController.update)
);
router.post(
  '/:id/reset-password',
  requireRoles('Admin'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.resetPassword)
);

export default router;
