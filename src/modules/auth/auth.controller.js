/**
 * Auth controller — pure HTTP translation. No business logic lives here:
 * it reads the request, calls the service, sets/clears the cookie, shapes
 * the response. If you find yourself writing an `if` about passwords or
 * tokens in this file, it belongs in auth.service.js.
 */
import env from '../../config/env.js';
import ApiResponse from '../../utils/ApiResponse.js';
import * as authService from './auth.service.js';
import { REFRESH_TOKEN_TTL_DAYS } from './auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

/**
 * Cookie settings — each flag is load-bearing:
 *   httpOnly : JavaScript can never read it → XSS can't steal it
 *   secure   : HTTPS-only in production
 *   sameSite : 'lax' blocks cross-site POSTs from sending it (CSRF guard)
 *   path     : only ever sent to /api/auth/* — no other endpoint sees it
 */
const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

/**
 * POST /api/auth/login
 * Body: { email, password } (validated by loginSchema)
 * 200 → data: { user, accessToken } + sets refresh cookie
 * 400 validation / 401 bad credentials / 429 rate limited
 */
export async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.login({
    ...req.body,
    ip: req.ip,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json(new ApiResponse('Logged in.', { user, accessToken }));
}

/**
 * POST /api/auth/refresh
 * Auth: refresh cookie only (no Bearer header — the access token may be dead)
 * 200 → data: { user, accessToken } + sets the NEXT refresh cookie (rotation)
 * 401 missing/expired/reused token
 * Returning `user` here lets the client restore a session after a page
 * reload with this single call.
 */
export async function refresh(req, res) {
  const { user, accessToken, refreshToken } = await authService.refresh({
    refreshToken: req.cookies[REFRESH_COOKIE],
    ip: req.ip,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json(new ApiResponse('Session refreshed.', { user, accessToken }));
}

/**
 * POST /api/auth/logout
 * Auth: refresh cookie (idempotent — succeeds even if already logged out)
 * 200 → clears the cookie and deletes this device's session
 */
export async function logout(req, res) {
  await authService.logout({ refreshToken: req.cookies[REFRESH_COOKIE], ip: req.ip });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json(new ApiResponse('Logged out.'));
}
