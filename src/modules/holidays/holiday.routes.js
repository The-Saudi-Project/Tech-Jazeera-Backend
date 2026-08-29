/**
 * Holiday routes (P3-B).
 *
 * Read-open to any authenticated user (Workers included — the ESS Leave page
 * shows the upcoming-holidays list); only Admin/Manager/HR shape the calendar.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createHolidaySchema,
  updateHolidaySchema,
  listHolidaysSchema,
  holidayIdParamSchema,
} from './holiday.validation.js';
import * as holidayController from './holiday.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listHolidaysSchema }), asyncHandler(holidayController.list));
router.post(
  '/',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ body: createHolidaySchema }),
  asyncHandler(holidayController.create)
);
router.patch(
  '/:id',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: holidayIdParamSchema, body: updateHolidaySchema }),
  asyncHandler(holidayController.update)
);
router.delete(
  '/:id',
  requireRoles('Admin', 'Manager', 'HR'),
  validate({ params: holidayIdParamSchema }),
  asyncHandler(holidayController.remove)
);

export default router;
