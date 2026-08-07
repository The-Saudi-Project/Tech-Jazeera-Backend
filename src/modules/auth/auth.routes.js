/**
 * Auth routes. Note what is NOT here: no /register — this is an internal
 * ERP, accounts are created by an Admin (seed script now, admin UI later),
 * never by self-signup.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';
import { loginSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

export default router;
