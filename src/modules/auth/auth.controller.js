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
 *   secure   : HTTPS-only in production (required for SameSite=None)
 *   sameSite : see below — differs by environment
 *   path     : only ever sent to /api/auth/* — no other endpoint sees it
 *
 * WHY sameSite IS NOT SIMPLY 'lax'.
 * In development the client (localhost:5173) and API (localhost:5000) are the
 * same site — a differing port does not change that — so 'lax' works and keeps
 * the strongest default.
 *
 * In production they are NOT: the frontend is on Vercel and the API is on
 * Render, which are different registrable domains. A 'lax' cookie is withheld
 * from cross-site requests, so the app's own POST /api/auth/refresh would never
 * receive it and every page reload would log the user out. 'none' is required
 * for the session to work at all, and browsers only accept it alongside Secure.
 *
 * 'none' means the browser will attach this cookie to requests from ANY site,
 * so the CSRF protection 'lax' was providing is replaced explicitly by
 * requireTrustedOrigin on these routes (see middleware/originGuard.js).
 */
const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/auth',
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

/**
 * PATCH /api/auth/password
 * Auth: Bearer (any logged-in role) + the current password in the body
 * 200 → clears the refresh cookie (every session was revoked) — the client
 * must treat this as a logout and send the user back to /login
 * 401 not logged in, or current password wrong
 */
export async function changePassword(req, res) {
  await authService.changePassword({ userId: req.user.id, ...req.body }, req.ip);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json(new ApiResponse('Password changed. Please sign in again.'));
}
