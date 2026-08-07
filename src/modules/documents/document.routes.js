/**
 * Document routes.
 *
 * Roles: read/preview/download for any authenticated user (internal tool).
 * Upload and versioning = Admin/Manager/HR/Operations. Delete is narrower
 * (Admin/Manager/HR) because it destroys files and history.
 *
 * Upload flow order: uploadSingle (Multer writes the file) → validate the
 * multipart text fields → controller. If validation or the controller fails,
 * the trailing error handler deletes the just-written file so a rejected
 * upload never leaves an orphan on disk.
 */
import { Router } from 'express';
import fs from 'node:fs';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingle } from '../../middleware/upload.js';
import {
  createDocumentSchema,
  listDocumentsSchema,
  documentIdParamSchema,
  fileQuerySchema,
} from './document.validation.js';
import * as documentController from './document.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff); // staff-only module; Workers use the ESS portal (P2-M2)

const canWrite = requireRoles('Admin', 'Manager', 'HR', 'Operations');
const canDelete = requireRoles('Admin', 'Manager', 'HR');

router.get('/', validate({ query: listDocumentsSchema }), asyncHandler(documentController.list));
router.get(
  '/:id',
  validate({ params: documentIdParamSchema }),
  asyncHandler(documentController.get)
);
router.get(
  '/:id/file',
  validate({ params: documentIdParamSchema, query: fileQuerySchema }),
  asyncHandler(documentController.file)
);
router.post(
  '/',
  canWrite,
  uploadSingle,
  validate({ body: createDocumentSchema }),
  asyncHandler(documentController.create)
);
router.post(
  '/:id/versions',
  canWrite,
  validate({ params: documentIdParamSchema }),
  uploadSingle,
  asyncHandler(documentController.addVersion)
);
router.delete(
  '/:id',
  canDelete,
  validate({ params: documentIdParamSchema }),
  asyncHandler(documentController.remove)
);

/**
 * Cleanup handler: if anything after Multer failed on an upload route, remove
 * the orphaned file before forwarding the error to the global handler.
 */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (req.file?.path) fs.unlink(req.file.path, () => {});
  next(err);
});

export default router;
