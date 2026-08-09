/**
 * Auth routes. Note what is NOT here: no /register — this is an internal
 * ERP, accounts are created by an Admin (seed script now, admin UI later),
 * never by self-signup.
 */
import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';
import { requireTrustedOrigin } from '../../middleware/originGuard.js';
import { loginSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = Router();

// These three are the only routes authenticated by a COOKIE rather than a
// Bearer header, which makes them the only ones a hostile site could trigger
// with the user's credentials attached. requireTrustedOrigin is their CSRF
// guard — see middleware/originGuard.js for why SameSite alone is not enough
// once the frontend and API live on different domains.
router.use(requireTrustedOrigin);

router.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

export default router;
