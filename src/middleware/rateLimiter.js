/**
 * Rate limiting — first line of defense against brute force and abuse.
 *
 * One general limiter covers the whole API. It is deliberately generous:
 * this is an internal ERP where one office IP serves many staff, and a
 * normal dashboard load fires many requests. Auth routes get a much
 * stricter limiter in M2, because login is the endpoint attackers hammer.
 */
import rateLimit from 'express-rate-limit';

/** Standard envelope so even rate-limited responses match the API contract. */
const limitReached = {
  success: false,
  message: 'Too many requests. Please wait a moment and try again.',
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 600, // per IP per window — roomy for an office sharing one IP
  standardHeaders: 'draft-7', // send RateLimit-* headers so clients can back off
  legacyHeaders: false,
  message: limitReached,
});

/**
 * Login-only limiter. 30/15min still lets a whole office log in during the
 * morning rush (one shared IP), but caps a password-guessing bot at a rate
 * where bcrypt + this limit make brute force hopeless. Applied ONLY to
 * POST /api/auth/login — refresh is self-throttling (it already requires a
 * validly signed token) and stays under the general limiter.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes and try again.',
  },
});

/**
 * Public NFC card pages (/c/:token). Tokens are 12 random base62 chars (~70
 * bits), so guessing is already hopeless; this caps automated scanning per IP.
 * Roomy for real visitors (each tap is a page + maybe a vCard fetch), tight
 * enough to make enumeration pointless. Returns a plain 429 (these are public
 * HTML routes, not the JSON API).
 */
export const publicCardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
});

/**
 * The tap page's click beacon (POST /c/:token/e). Separate from the page
 * limiter because one visit can fire several of these — tapping Call, then
 * WhatsApp, then Website is three beacons on top of the page view — and
 * sharing a budget would let normal use exhaust the page limit. Each one is a
 * tiny insert, so the cap is higher; it exists to stop a flood of writes, not
 * to police real visitors.
 */
export const publicEventLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
});
