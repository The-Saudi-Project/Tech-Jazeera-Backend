/**
 * Downloadable "visiting card" image — a portrait PNG with real text (name,
 * job title, company, phone, email, ...), not just tappable icons, plus a
 * QR code that reopens the same public tap page. Built the same way the
 * card's own QR endpoint already is: hand-composed SVG → sharp raster
 * (nfc.qr.js's svgToPng) — no new dependency, and the QR itself is the
 * SAME generatePremiumQrSvg output nested in unmodified, not regenerated.
 *
 * Generated fresh on every request, never stored — mirrors the QR endpoint's
 * own "always reflects current data" posture, and means an admin edit
 * (including a *Ar field) shows up on the very next download.
 */
import { generatePremiumQrSvg, lighten, svgToPng } from './nfc.qr.js';
import { UI_STRINGS, pickLang } from './nfc.i18n.js';
import logger from '../../config/logger.js';

const WIDTH = 1080;
// Height is content-driven (see buildCardImagePng), not fixed — a card with
// no photo and only one or two contact rows would otherwise leave a large
// dead black area below the QR. MIN_HEIGHT keeps a very sparse card from
// looking too short/squat; BOTTOM_PADDING is the breathing room after the
// last element (the public URL caption).
const MIN_HEIGHT = 1200;
const BOTTOM_PADDING = 90;
const DEFAULT_BRAND = '#1f9e78';
const safeHex = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : DEFAULT_BRAND);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fetch a remote image's bytes and inline them as a base64 data: URI.
 * sharp's SVG rasterizer (librsvg) can't reliably fetch a remote https://
 * image referenced inside the SVG itself, so embedding is the only
 * dependable way to get a Cloudinary logo/photo into a generated raster —
 * same precedent as companySettings.service.js's getLogoForEmbedding().
 * Best-effort: a failed fetch just omits that image, exactly like every
 * other best-effort path in this module — it must never break the download.
 */
async function fetchImageAsDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    logger.warn(`[nfc] failed to fetch image for card download: ${err.message}`);
    return null;
  }
}

// Arabic gets its own font stack (Latin fonts don't carry Arabic glyphs);
// English/LTR values (phone/email/website) always render in the Latin stack
// regardless of the card's language, since digits/URLs shouldn't mirror.
const FONT_LATIN = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
const FONT_ARABIC = "'Noto Sans Arabic','Segoe UI',Tahoma,sans-serif";

/**
 * data = { employee, company, lang, cardUrl, logoUrl, photoUrl }
 * `lang` is 'en' | 'ar' — everything text-bearing resolves through
 * pickLang/UI_STRINGS the same way the live HTML page's toggle does, so a
 * downloaded card always matches what was on screen when it was requested.
 */
export async function buildCardImagePng({ employee, company, lang, cardUrl, logoUrl, photoUrl }) {
  const isAr = lang === 'ar';
  const font = isAr ? FONT_ARABIC : FONT_LATIN;
  const strings = UI_STRINGS[isAr ? 'ar' : 'en'];
  const brand = safeHex(company?.brandColour);
  const accent = lighten(brand, 0.35);

  const bg = '#0a0a0d';
  const textColor = '#f4f4f5';
  const muted = '#a1a1aa';
  const hair = 'rgba(255,255,255,0.14)';
  const panelBg = 'rgba(255,255,255,0.05)';

  // pickLang means "the Arabic value, falling back to English if blank" —
  // correct for computing what Arabic SHOULD show. But this image only ever
  // renders ONE language per request (the `lang` query param), so English
  // must render as English even when an Arabic value exists — never
  // "whichever is filled in", the same mistake the toggle page avoids by
  // keeping data-en/data-ar as two separate attributes and letting the
  // click choose, rather than pre-resolving to one string.
  const name = isAr ? pickLang(employee.nameAr, employee.name) : employee.name;
  const jobTitle = isAr ? pickLang(employee.jobTitleAr, employee.jobTitle) : employee.jobTitle;
  const orgName = isAr ? pickLang(company?.companyNameAr, company?.companyName) : company?.companyName;

  const [logoDataUri, photoDataUri] = await Promise.all([
    fetchImageAsDataUri(logoUrl),
    fetchImageAsDataUri(photoUrl),
  ]);

  const cx = WIDTH / 2;
  let y = 110;
  const parts = [];

  if (logoDataUri) {
    const logoW = 300;
    const logoH = 84;
    parts.push(
      `<image href="${logoDataUri}" x="${cx - logoW / 2}" y="${y}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`
    );
    y += logoH + 36;
  }

  if (photoDataUri) {
    const r = 130;
    const photoCy = y + r;
    parts.push(`<clipPath id="photoClip"><circle cx="${cx}" cy="${photoCy}" r="${r}"/></clipPath>`);
    parts.push(`<circle cx="${cx}" cy="${photoCy}" r="${r + 5}" fill="none" stroke="${brand}" stroke-width="5"/>`);
    parts.push(
      `<image href="${photoDataUri}" x="${cx - r}" y="${photoCy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`
    );
    y = photoCy + r + 56;
  } else {
    y += 20;
  }

  parts.push(
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${font}" font-size="58" font-weight="700" fill="${textColor}">${esc(name)}</text>`
  );
  y += 56;

  if (jobTitle) {
    parts.push(
      `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${font}" font-size="30" fill="${muted}">${esc(jobTitle)}</text>`
    );
    y += 48;
  }

  if (orgName) {
    const displayOrg = isAr ? orgName : orgName.toUpperCase();
    const spacing = isAr ? '' : ' letter-spacing="3"';
    parts.push(
      `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${font}" font-size="26" font-weight="700" fill="${accent}"${spacing}>${esc(displayOrg)}</text>`
    );
    y += 56;
  }

  parts.push(`<line x1="${cx - 200}" y1="${y}" x2="${cx + 200}" y2="${y}" stroke="${hair}" stroke-width="2"/>`);
  y += 64;

  const rows = [
    { label: strings.call, value: employee.phone },
    { label: strings.whatsapp, value: employee.whatsapp || employee.phone },
    { label: strings.email, value: employee.email },
    { label: strings.website, value: company?.website },
  ].filter((row) => row.value);

  for (const row of rows) {
    const panelY = y - 34;
    const label = isAr ? row.label : row.label.toUpperCase();
    const spacing = isAr ? '' : ' letter-spacing="1"';
    parts.push(`<rect x="${cx - 300}" y="${panelY}" width="600" height="96" rx="20" fill="${panelBg}" stroke="${hair}" stroke-width="1"/>`);
    parts.push(
      `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${font}" font-size="20" font-weight="700" fill="${muted}"${spacing}>${esc(label)}</text>`
    );
    parts.push(
      `<text x="${cx}" y="${y + 36}" text-anchor="middle" direction="ltr" font-family="${FONT_LATIN}" font-size="30" font-weight="600" fill="${textColor}">${esc(row.value)}</text>`
    );
    y += 118;
  }

  y += 20;
  const qrSize = 240;
  const qrSvg = generatePremiumQrSvg(cardUrl, { brandColour: brand, size: qrSize });
  parts.push(`<g transform="translate(${cx - qrSize / 2}, ${y})">${qrSvg}</g>`);
  y += qrSize + 36;
  parts.push(
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${font}" font-size="22" font-weight="600" fill="${muted}">${esc(strings.scan)}</text>`
  );
  y += 34;
  parts.push(
    `<text x="${cx}" y="${y}" text-anchor="middle" direction="ltr" font-family="${FONT_LATIN}" font-size="18" fill="${muted}">${esc(cardUrl.replace(/^https?:\/\//, ''))}</text>`
  );
  y += BOTTOM_PADDING;

  const height = Math.max(MIN_HEIGHT, y);
  const background = [
    `<rect x="0" y="0" width="${WIDTH}" height="${height}" fill="${bg}"/>`,
    `<circle cx="${cx}" cy="420" r="620" fill="url(#glow)"/>`,
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
<defs>
  <radialGradient id="glow" cx="50%" cy="30%" r="60%">
    <stop offset="0%" stop-color="${brand}" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="${brand}" stop-opacity="0"/>
  </radialGradient>
</defs>
${background.join('\n')}
${parts.join('\n')}
</svg>`;

  return svgToPng(svg, { width: WIDTH, height });
}
