/**
 * Public NFC tap routes — served by Express (not the SPA) so Open Graph and
 * `noindex` work for crawlers. Unauthenticated, rate-limited, and deliberately
 * information-free: any bad/inactive/unassigned token renders the SAME 404 page.
 *
 * These routes get their own Content-Security-Policy, replacing the app-wide
 * default set by helmet(), for two reasons:
 *
 *   1. The default is `script-src 'self'`, which BLOCKS the page's inline
 *      script. Rather than weaken it to 'unsafe-inline' (which would let any
 *      injected script run), each response gets a random nonce and the one
 *      script we control carries it.
 *   2. The default includes `upgrade-insecure-requests`, which rewrites the
 *      page's own logo/photo requests to https. During a LAN trial the server
 *      is plain http, so that silently breaks every image on the card.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import helmet from 'helmet';
import asyncHandler from '../../utils/asyncHandler.js';
import logger from '../../config/logger.js';
import { publicCardLimiter, publicEventLimiter } from '../../middleware/rateLimiter.js';
import { getPublicCardByToken, cardUrl } from './nfc.service.js';
import { renderProfilePage, renderNotFoundPage } from './nfc.publicPage.js';
import { buildVCard } from './nfc.vcard.js';
import { recordTapEvent } from './nfc.analytics.service.js';
import { NFC_CLICK_TARGETS } from './nfcTapEvent.model.js';

const router = Router();

const TOKEN_RE = /^[A-Za-z0-9]{6,24}$/;

/** Fresh nonce per response — the whole point is that it is unguessable. */
router.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

router.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'form-action': ["'self'"],
      'img-src': ["'self'", 'data:', 'https://res.cloudinary.com'],
      // Inline styles only; the page has no external stylesheet. Style
      // injection cannot execute code, so this is a much smaller risk than
      // inline script and matches helmet's own default.
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      'connect-src': ["'self'"], // the click beacon posts back here
    },
  })
);

router.use(publicCardLimiter);

function notFound(res) {
  res.status(404).type('html').send(renderNotFoundPage());
}

/** GET /c/:token — the mobile profile page. */
router.get('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!TOKEN_RE.test(token)) return notFound(res);
  const data = await getPublicCardByToken(token);
  if (!data) return notFound(res);

  const html = renderProfilePage({
    ...data,
    cardUrl: cardUrl(token),
    vcardUrl: `${cardUrl(token)}/vcard`,
    token,
    nonce: res.locals.nonce,
  });
  res.status(200).type('html').send(html);

  // After the response — a slow analytics write must not delay the card.
  recordTapEvent({ ref: data.ref, type: 'view', req });
}));

/** GET /c/:token/vcard — one-tap Save Contact (.vcf). */
router.get('/:token/vcard', asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!TOKEN_RE.test(token)) return notFound(res);
  const data = await getPublicCardByToken(token);
  if (!data) return notFound(res);
  const safeName = (data.employee.name || 'contact').replace(/[^\w]+/g, '_');
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.vcf"`);
  res.send(buildVCard(data));

  recordTapEvent({ ref: data.ref, type: 'save', req });
}));

/**
 * POST /c/:token/e — the click beacon.
 *
 * Call/WhatsApp/email/website links navigate the visitor away without ever
 * touching this server, so a click can only be counted by the page telling us.
 * The alternative — routing every link through a redirect — breaks `tel:` on
 * iOS and kills long-press-to-copy, so the links stay real links and this
 * endpoint is best-effort.
 *
 * Always answers 204, even for a bad token: it must not become a way to probe
 * which tokens exist.
 */
router.post('/:token/e', publicEventLimiter, async (req, res) => {
  res.status(204).end();

  // Deliberately NOT wrapped in asyncHandler: the response has already gone
  // out, so a failure here has nowhere to be reported except the log.
  try {
    const { token } = req.params;
    if (!TOKEN_RE.test(token)) return;
    const target = req.body?.target;
    if (!NFC_CLICK_TARGETS.includes(target)) return;

    const data = await getPublicCardByToken(token);
    if (!data) return;
    await recordTapEvent({ ref: data.ref, type: 'click', target, req });
  } catch (err) {
    logger.warn(`[nfc] click beacon failed: ${err.message}`);
  }
});

export default router;
