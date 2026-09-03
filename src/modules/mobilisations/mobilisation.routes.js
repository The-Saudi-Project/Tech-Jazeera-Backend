/**
 * Mobilisation routes.
 *
 * Only `requireStaff` at the router level: who may create/edit/decide a
 * mobilisation depends on ApprovalRole membership and document ownership
 * (coordinator/primary/current-step-reviewer), none of which is expressible
 * as a static `User.role` list — same reasoning as client.routes.js leaving
 * the finer rules to the service.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import logger from '../../config/logger.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireStaff } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { uploadMultiple, destroyDocumentFile } from '../../middleware/upload.js';
import {
  createMobilisationSchema,
  updateMobilisationSchema,
  listMobilisationsSchema,
  mobilisationIdParamSchema,
  mobilisationCoordinatorParamSchema,
  addCoordinatorSchema,
  commercialDetailsSchema,
  decideMobilisationSchema,
  mobilisationDocumentCategorySchema,
  mobilisationDocumentParamSchema,
} from './mobilisation.validation.js';
import * as mobilisationController from './mobilisation.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireStaff);

router.get('/', validate({ query: listMobilisationsSchema }), asyncHandler(mobilisationController.list));
// Before the /:id catch-all, or "coordinators" is read as a mobilisation id.
router.get('/coordinators', asyncHandler(mobilisationController.listCoordinatorCandidates));
router.get('/:id', validate({ params: mobilisationIdParamSchema }), asyncHandler(mobilisationController.get));
router.post('/', validate({ body: createMobilisationSchema }), asyncHandler(mobilisationController.create));
router.patch(
  '/:id',
  validate({ params: mobilisationIdParamSchema, body: updateMobilisationSchema }),
  asyncHandler(mobilisationController.update)
);

// --- M2: joint coordinators + submit ---
router.post(
  '/:id/coordinators',
  validate({ params: mobilisationIdParamSchema, body: addCoordinatorSchema }),
  asyncHandler(mobilisationController.addCoordinator)
);
router.delete(
  '/:id/coordinators/:userId',
  validate({ params: mobilisationCoordinatorParamSchema }),
  asyncHandler(mobilisationController.removeCoordinator)
);
router.patch(
  '/:id/coordinators/:userId/confirm',
  validate({ params: mobilisationCoordinatorParamSchema }),
  asyncHandler(mobilisationController.confirmCoordinator)
);
router.post(
  '/:id/submit',
  validate({ params: mobilisationIdParamSchema }),
  asyncHandler(mobilisationController.submit)
);

// --- M3: Marketing Manager review ---
router.patch(
  '/:id/commercial-details',
  validate({ params: mobilisationIdParamSchema, body: commercialDetailsSchema }),
  asyncHandler(mobilisationController.saveCommercialDetails)
);
router.patch(
  '/:id/decide',
  validate({ params: mobilisationIdParamSchema, body: decideMobilisationSchema }),
  asyncHandler(mobilisationController.decide)
);

// --- M5: documents ---
router.post(
  '/:id/documents',
  validate({ params: mobilisationIdParamSchema }),
  uploadMultiple,
  validate({ body: mobilisationDocumentCategorySchema }),
  asyncHandler(mobilisationController.addDocuments)
);
router.delete(
  '/:id/documents/:fileId',
  validate({ params: mobilisationDocumentParamSchema }),
  asyncHandler(mobilisationController.removeDocument)
);
router.get(
  '/:id/documents/:fileId/file',
  validate({ params: mobilisationDocumentParamSchema }),
  asyncHandler(mobilisationController.documentFile)
);

/** Same orphaned-upload cleanup as document.routes.js/financialRequests.routes.js
 *  — only the documents POST above ever sets req.files on this router. */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (req.files?.length) {
    for (const file of req.files) {
      if (!file.filename) continue;
      destroyDocumentFile(file.filename).catch((cleanupErr) =>
        logger.error(`[mobilisations] orphaned upload ${file.filename}: ${cleanupErr.message}`)
      );
    }
  }
  next(err);
});

export default router;
