/**
 * NFC admin routes — the whole platform behind Admin auth. Separate from the
 * public tap routes (nfc.public.routes.js), which are unauthenticated.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createCompanySchema,
  updateCompanySchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  generateBatchSchema,
  updateCardSchema,
  assignCardSchema,
  listCardsSchema,
  listCompaniesSchema,
  idParamSchema,
  analyticsQuerySchema,
} from './nfc.validation.js';
import { uploadNfcImage } from './nfc.upload.js';
import * as nfc from './nfc.controller.js';

const router = Router();
router.use(requireAuth, requireRoles('Admin'));

// Analytics (see nfc.analytics.service.js). Mounted before the resource routes
// so /analytics is never mistaken for an id.
router.get('/analytics', validate({ query: analyticsQuerySchema }), asyncHandler(nfc.overviewAnalytics));
router.get('/cards/:id/analytics', validate({ params: idParamSchema, query: analyticsQuerySchema }), asyncHandler(nfc.cardAnalytics));
router.get('/companies/:id/analytics', validate({ params: idParamSchema, query: analyticsQuerySchema }), asyncHandler(nfc.companyAnalytics));

// Companies
router.get('/companies', validate({ query: listCompaniesSchema }), asyncHandler(nfc.listCompanies));
router.post('/companies', validate({ body: createCompanySchema }), asyncHandler(nfc.createCompany));
router.get('/companies/:id', validate({ params: idParamSchema }), asyncHandler(nfc.getCompany));
router.patch('/companies/:id', validate({ params: idParamSchema, body: updateCompanySchema }), asyncHandler(nfc.updateCompany));
router.delete('/companies/:id', validate({ params: idParamSchema }), asyncHandler(nfc.deleteCompany));
router.post('/companies/:id/logo', validate({ params: idParamSchema }), uploadNfcImage, asyncHandler(nfc.uploadCompanyLogo));
router.delete('/companies/:id/logo', validate({ params: idParamSchema }), asyncHandler(nfc.removeCompanyLogo));

// People
router.post('/employees', validate({ body: createEmployeeSchema }), asyncHandler(nfc.createEmployee));
router.patch('/employees/:id', validate({ params: idParamSchema, body: updateEmployeeSchema }), asyncHandler(nfc.updateEmployee));
router.delete('/employees/:id', validate({ params: idParamSchema }), asyncHandler(nfc.deleteEmployee));
router.post('/employees/:id/photo', validate({ params: idParamSchema }), uploadNfcImage, asyncHandler(nfc.uploadEmployeePhoto));
router.delete('/employees/:id/photo', validate({ params: idParamSchema }), asyncHandler(nfc.removeEmployeePhoto));

// Batches
router.post('/batches', validate({ body: generateBatchSchema }), asyncHandler(nfc.generateBatch));
router.get('/batches', asyncHandler(nfc.listBatches));
router.get('/batches/:id/cards.csv', validate({ params: idParamSchema }), asyncHandler(nfc.batchCsv));

// Cards
router.get('/cards', validate({ query: listCardsSchema }), asyncHandler(nfc.listCards));
router.get('/cards/:id', validate({ params: idParamSchema }), asyncHandler(nfc.getCard));
router.get('/cards/:id/qr.png', validate({ params: idParamSchema }), asyncHandler(nfc.cardQr));
router.patch('/cards/:id', validate({ params: idParamSchema, body: updateCardSchema }), asyncHandler(nfc.updateCard));
router.post('/cards/:id/assign', validate({ params: idParamSchema, body: assignCardSchema }), asyncHandler(nfc.assignCard));
router.post('/cards/:id/unassign', validate({ params: idParamSchema }), asyncHandler(nfc.unassignCard));
router.post('/cards/:id/lost', validate({ params: idParamSchema }), asyncHandler(nfc.markLost));
router.post('/cards/:id/return', validate({ params: idParamSchema }), asyncHandler(nfc.markReturned));
router.post('/cards/:id/disable', validate({ params: idParamSchema }), asyncHandler(nfc.disableCard));
router.post('/cards/:id/rotate', validate({ params: idParamSchema }), asyncHandler(nfc.rotateToken));

export default router;
