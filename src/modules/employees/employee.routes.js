/**
 * Employee routes.
 *
 * Role design: every authenticated role may READ (the whole company runs on
 * looking employees up); WRITE is Admin/Manager/HR (the people who own
 * workforce data); DELETE is Admin/HR only — it destroys history, so the
 * circle is smaller. Status 'Exited' is the everyday alternative to delete.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesSchema,
  employeeIdParamSchema,
  createLoginSchema,
} from './employee.validation.js';
import * as employeeController from './employee.controller.js';

const router = Router();

// Everything below requires a logged-in STAFF user. Workers (P2-M1) are the
// self-service persona and have no business in the workforce register — they
// get a clean 403 here and use the ESS portal (P2-M2) instead.
router.use(requireAuth);
router.use(requireStaff);

router.get('/', validate({ query: listEmployeesSchema }), asyncHandler(employeeController.list));
router.get(
  '/:id',
  validate({ params: employeeIdParamSchema }),
  asyncHandler(employeeController.get)
);
router.post(
  '/',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ body: createEmployeeSchema }),
  asyncHandler(employeeController.create)
);
router.patch(
  '/:id',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  asyncHandler(employeeController.update)
);
router.delete(
  '/:id',
  requireRoles('Admin', 'HR'),
  validate({ params: employeeIdParamSchema }),
  asyncHandler(employeeController.remove)
);

// Provision a Worker login for this employee (P2-M1). Admin/HR only — the same
// circle that owns workforce data owns account creation for it. Returns a
// one-time temporary password for the admin to hand over.
router.post(
  '/:id/user',
  requireRoles('Admin', 'HR'),
  validate({ params: employeeIdParamSchema, body: createLoginSchema }),
  asyncHandler(employeeController.createLogin)
);

export default router;
