/**
 * Fixed UI-chrome strings for the public tap page and the downloadable card
 * image (Milestone B). The page itself is server-rendered HTML with no
 * i18next access at all (see nfc.publicPage.js's own doc comment), so these
 * live here instead — a small hardcoded EN/AR map both consumers import,
 * rather than each keeping its own copy that could silently drift apart.
 */
export const UI_STRINGS = {
  en: {
    save: 'Save Contact',
    call: 'Call',
    whatsapp: 'WhatsApp',
    email: 'Email',
    altEmail: 'Alternate Email',
    website: 'Website',
    linkedin: 'LinkedIn',
    location: 'Location',
    footer: 'Tap · Connect',
    download: 'Download card',
    scan: 'Scan to connect',
  },
  ar: {
    save: 'حفظ جهة الاتصال',
    call: 'اتصال',
    whatsapp: 'واتساب',
    email: 'البريد الإلكتروني',
    altEmail: 'البريد الإلكتروني البديل',
    website: 'الموقع الإلكتروني',
    linkedin: 'لينكد إن',
    location: 'الموقع',
    footer: 'المس · تواصل',
    download: 'تنزيل البطاقة',
    scan: 'امسح للتواصل',
  },
};

/** The one fallback rule used everywhere: a manually-entered Arabic value if
 *  present, else the English source — never a blank line when Arabic is
 *  selected. Every *Ar field on NfcEmployee/NfcCompany is optional by
 *  design (never auto-translated), so this is the single place that decides
 *  what actually gets shown. */
export function pickLang(ar, en) {
  return ar && String(ar).trim() ? ar : (en ?? '');
}
