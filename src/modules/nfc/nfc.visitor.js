/**
 * Turning a raw HTTP request into a privacy-safe analytics context.
 *
 * Everything here is a pure function of the request headers — no database, no
 * network, no dependencies. That is deliberate: geolocation and device
 * detection are the two places analytics code normally reaches for a fat
 * library, and neither is worth one here.
 *
 *   Country  comes from the CDN/proxy header the platform already sets
 *            (Cloudflare, Vercel, App Engine). Nothing to install, nothing to
 *            keep up to date, and the visitor's IP never has to be processed.
 *            CAVEAT: these headers are only trustworthy when the server really
 *            does sit behind such a proxy — direct traffic could send a fake
 *            one. Strict validation caps the damage at a wrong country code on
 *            an analytics chart, which is why this is acceptable here and would
 *            not be for anything security-relevant.
 *
 *   Device   is a handful of user-agent substrings. UA parsing is a bottomless
 *            pit if you want exact browser versions; we only need
 *            phone/tablet/desktop and iOS/Android, which is a dozen lines.
 */
import crypto from 'node:crypto';
import env from '../../config/env.js';
import { NFC_DEVICE_TYPES, NFC_PLATFORMS } from './nfcTapEvent.model.js';

/**
 * Headers set by the edge platform in front of the app. Checked in order; the
 * first valid one wins.
 */
const COUNTRY_HEADERS = [
  'cf-ipcountry', // Cloudflare (including `cloudflared` tunnels)
  'x-vercel-ip-country', // Vercel
  'x-appengine-country', // Google App Engine
  'x-geo-country', // common nginx/CDN convention
];

/** Cloudflare's placeholders for "no idea" and "Tor exit node". */
const NON_COUNTRIES = new Set(['XX', 'T1', 'ZZ']);

/**
 * Automated clients that fetch a card URL without a human ever seeing it.
 * The big one is link-preview unfurling: paste a card URL into WhatsApp and
 * Meta's servers fetch the page to build the preview card. Counting those as
 * "views" would quietly inflate every number on the dashboard.
 */
const BOT_RE =
  /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|twitter|discord|linkedinbot|embedly|quora|pinterest|redditbot|applebot|bingpreview|preview|monitor|uptime|pingdom|curl|wget|python-requests|axios|okhttp|java\/|go-http-client|headlesschrome|lighthouse|phantomjs|puppeteer|playwright/i;

/**
 * True for automated traffic that should never count as a real tap.
 *
 * Two rules, because a blocklist alone is never complete:
 *
 *   1. Known crawlers and unfurlers, some of which deliberately look like a
 *      browser (Googlebot sends "Mozilla/5.0 (compatible; Googlebot/2.1…)").
 *   2. Anything that does not identify as a browser at all. Effectively every
 *      real browser — Chrome, Safari, Firefox, Edge, Samsung, Opera, UC — sends
 *      a user agent starting "Mozilla/", a fossil of 1990s browser sniffing.
 *      HTTP libraries do not: `node`, `curl/8.5`, `python-requests/2.31`,
 *      `Go-http-client/1.1`, `okhttp/4.12`. This catches the ones nobody
 *      thought to list.
 *
 * When in doubt this errs toward NOT counting. An undercount is a slightly
 * pessimistic chart; an overcount is a number the owner would act on wrongly.
 */
export function isBot(userAgent) {
  const ua = String(userAgent ?? '').trim();
  if (!ua) return true; // a browser always sends one
  if (BOT_RE.test(ua)) return true;
  return !/^Mozilla\//i.test(ua);
}

/** ISO 3166-1 alpha-2 from the edge proxy, or null if unknown/absent. */
export function countryFrom(req) {
  for (const header of COUNTRY_HEADERS) {
    const raw = req.get(header);
    if (!raw) continue;
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && !NON_COUNTRIES.has(code)) return code;
  }
  return null;
}

/** 'mobile' | 'tablet' | 'desktop' — coarse on purpose. */
export function deviceFrom(userAgent) {
  const ua = String(userAgent ?? '');
  // Android tablets omit "Mobile"; that absence is the only reliable signal.
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet';
  }
  if (/Mobi|iPhone|iPod|Android|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Coarse platform bucket. */
export function platformFrom(userAgent) {
  const ua = String(userAgent ?? '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  // Order matters: iOS is checked first, so "Mac OS X" here means a real Mac.
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  return 'Other';
}

/**
 * The referrer's HOST only — never the path or query, which routinely carry
 * search terms, session ids and other things that are none of our business.
 * Same-host referrers (our own page beaconing a click) are dropped as noise.
 */
export function referrerHostFrom(req) {
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    const { hostname } = new URL(referer);
    if (!hostname || hostname === req.hostname) return null;
    return hostname.slice(0, 120);
  } catch {
    return null; // malformed Referer header
  }
}

/**
 * Daily-rotating salt, derived from an existing server secret rather than a new
 * one (no invented credentials). Domain-separated so it can never collide with
 * token signing, and one-way, so the salt cannot be walked back to the secret.
 *
 * Rotating daily is the point: it makes "same person, two different days"
 * uncomputable even for whoever holds the database.
 */
let saltCache = { day: null, value: null };
function dailySalt() {
  const day = new Date().toISOString().slice(0, 10); // UTC day
  if (saltCache.day !== day) {
    saltCache = {
      day,
      value: crypto.createHash('sha256').update(`nfc-analytics:${env.jwtAccessSecret}:${day}`).digest('hex'),
    };
  }
  return saltCache.value;
}

/**
 * Pseudonymous per-card, per-day visitor id. The IP is used as hash input and
 * immediately discarded — it is never stored, logged, or returned.
 */
export function visitorHash(req, cardId) {
  return crypto
    .createHash('sha256')
    .update(`${dailySalt()}:${req.ip ?? ''}:${req.get('user-agent') ?? ''}:${cardId}`)
    .digest('hex')
    .slice(0, 32);
}

/** Everything the event model needs from the request, in one call. */
export function eventContext(req, cardId) {
  const ua = req.get('user-agent');
  const device = deviceFrom(ua);
  const platform = platformFrom(ua);
  return {
    country: countryFrom(req),
    device: NFC_DEVICE_TYPES.includes(device) ? device : null,
    platform: NFC_PLATFORMS.includes(platform) ? platform : null,
    referrerHost: referrerHostFrom(req),
    visitor: visitorHash(req, cardId),
  };
}
