/**
 * NfcTapEvent — one row per meaningful interaction with a public tap page.
 *
 * PRIVACY IS THE DESIGN CONSTRAINT HERE. The people who tap a card are members
 * of the public, not staff, so this collection deliberately stores NO directly
 * identifying data: no IP address, no full user agent, no full referrer URL.
 * What it stores instead is the smallest set that answers "is this card
 * working?" — what happened, when, roughly where, and on what kind of device.
 *
 * `visitor` is a one-way hash whose salt rotates daily (see nfc.analytics.js),
 * so it can distinguish two people tapping the same card on the same day but
 * cannot follow anybody across days and cannot be reversed to an IP.
 *
 * Rows self-delete after RETENTION_DAYS via a TTL index — analytics data that
 * nobody is going to look at is just liability sitting in a database.
 *
 * The card/employee/company references are captured AT EVENT TIME so history
 * survives a card being reassigned or a person being deleted later.
 */
import mongoose from 'mongoose';

/**
 * `save`  = saved the contact to their phone (vCard).
 * `image` = saved the card as a picture (reserved for the card-image feature;
 *           declared here so adding it later needs no schema change).
 */
export const NFC_EVENT_TYPES = ['view', 'save', 'image', 'click'];

/** The tappable rows on the card, mirroring nfc.publicPage.js. */
export const NFC_CLICK_TARGETS = ['call', 'whatsapp', 'email', 'website', 'linkedin', 'location'];

export const NFC_DEVICE_TYPES = ['mobile', 'tablet', 'desktop'];

/** Coarse platform buckets — iOS vs Android is the interesting split for NFC. */
export const NFC_PLATFORMS = ['iOS', 'Android', 'Windows', 'macOS', 'Other'];

/** How long raw events are kept before MongoDB removes them automatically. */
export const RETENTION_DAYS = 400;

const nfcTapEventSchema = new mongoose.Schema(
  {
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcCard', required: true },
    // Who the card pointed at when the event happened (not "who holds it now").
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcEmployee', default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'NfcCompany', default: null },

    type: { type: String, enum: NFC_EVENT_TYPES, required: true },
    // Which row was tapped. Only set when type === 'click'.
    target: { type: String, enum: [...NFC_CLICK_TARGETS, null], default: null },

    at: { type: Date, default: () => new Date() },

    // ISO 3166-1 alpha-2, read from the CDN/proxy country header. Null when the
    // server sits behind no such proxy (e.g. a LAN trial) — never guessed.
    country: { type: String, default: null },
    device: { type: String, enum: [...NFC_DEVICE_TYPES, null], default: null },
    platform: { type: String, enum: [...NFC_PLATFORMS, null], default: null },
    // Referring HOST only ("wa.me"), never the full URL — full referrers leak
    // whatever page the visitor came from.
    referrerHost: { type: String, default: null },

    // Daily-salted one-way hash. Enables "unique visitors" without identity.
    visitor: { type: String, default: null },
  },
  { timestamps: false, versionKey: false }
);

// Automatic expiry. Doubles as the plain `at` index the overview queries use.
nfcTapEventSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

// Per-card panels and the reload-dedupe lookup.
nfcTapEventSchema.index({ card: 1, type: 1, at: -1 });

// Company rollups and the per-person breakdown on a company profile.
nfcTapEventSchema.index({ company: 1, at: -1 });

export default mongoose.model('NfcTapEvent', nfcTapEventSchema);
