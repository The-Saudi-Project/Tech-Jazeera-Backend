/**
 * NFC analytics — recording taps and aggregating them for the admin screens.
 *
 * Recording NEVER breaks a page. A tap page that fails to load because an
 * analytics write failed would be a self-inflicted outage on the one thing that
 * has to work in front of a customer, so every write is best-effort: callers do
 * not await it and this module never throws.
 *
 * Reading is done with a single `$facet` aggregation per screen. A facet runs
 * many independent pipelines over one pass of the matched documents, so the
 * panel's six numbers cost one round trip instead of six.
 */
import mongoose from 'mongoose';
import NfcTapEvent from './nfcTapEvent.model.js';
import NfcCard from './nfcCard.model.js';
import NfcEmployee from './nfcEmployee.model.js';
import NfcCompany from './nfcCompany.model.js';
import logger from '../../config/logger.js';
import { isBot, eventContext } from './nfc.visitor.js';

/**
 * Reporting timezone, as a fixed UTC offset rather than an IANA name.
 *
 * Saudi Arabia does not observe daylight saving, so Riyadh is permanently
 * UTC+03:00 and a fixed offset is exact, not an approximation. Using the very
 * same string for MongoDB's bucketing and for the JavaScript range boundary
 * means the two can never drift apart.
 *
 * (Attendance uses UTC because it stores date-only keys. These are real
 * instants, so "which day was this tapped" has to mean the local day.)
 */
const REPORT_TZ = '+03:00';
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long after an identical event from the same visitor a repeat is ignored.
 * A page reload should not read as a second visitor, and iOS occasionally
 * fetches a .vcf twice. Clicks are never deduped — every tap is intentional.
 */
const DEDUPE_MS = { view: 30 * 60 * 1000, save: 2 * 60 * 1000, image: 2 * 60 * 1000, click: 0 };

const toId = (v) => (v ? new mongoose.Types.ObjectId(String(v)) : null);

/** Local (Riyadh) calendar day of an instant, as `YYYY-MM-DD`. */
const dayKey = (date) => new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);

/** A whole-days window ending today, so the first bar is never a part-day. */
function resolveRange(days) {
  const now = new Date();
  const startKey = dayKey(new Date(now.getTime() - (days - 1) * DAY_MS));
  return { since: new Date(`${startKey}T00:00:00.000${REPORT_TZ}`), until: now, days, startKey };
}

/** Every day in the window, so a quiet day shows a zero instead of vanishing. */
function fillSeries(rows, { startKey, days }) {
  const found = new Map(rows.map((r) => [r._id, r]));
  const start = new Date(`${startKey}T00:00:00.000${REPORT_TZ}`);
  return Array.from({ length: days }, (_, i) => {
    const date = dayKey(new Date(start.getTime() + i * DAY_MS));
    const row = found.get(date);
    return {
      date,
      views: row?.views ?? 0,
      saves: row?.saves ?? 0,
      images: row?.images ?? 0,
      clicks: row?.clicks ?? 0,
    };
  });
}

/** `$sum` that counts only events of one type. */
const countOf = (type) => ({ $sum: { $cond: [{ $eq: ['$type', type] }, 1, 0] } });

const TYPE_COUNTS = { views: countOf('view'), saves: countOf('save'), images: countOf('image'), clicks: countOf('click') };

/** Shared facet pipelines used by every screen. */
const seriesPipeline = [
  { $group: { _id: { $dateToString: { date: '$at', format: '%Y-%m-%d', timezone: REPORT_TZ } }, ...TYPE_COUNTS } },
  { $sort: { _id: 1 } },
];
const uniquePipeline = [{ $match: { type: 'view' } }, { $group: { _id: '$visitor' } }, { $count: 'n' }];
const targetsPipeline = [
  { $match: { type: 'click', target: { $ne: null } } },
  { $group: { _id: '$target', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
];
const breakdown = (field, limit = 8) => [
  { $match: { [field]: { $ne: null } } },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: limit },
];

const totalsFrom = (rows) => ({
  views: rows[0]?.views ?? 0,
  saves: rows[0]?.saves ?? 0,
  images: rows[0]?.images ?? 0,
  clicks: rows[0]?.clicks ?? 0,
});
const listFrom = (rows) => rows.map((r) => ({ key: r._id, count: r.count }));

// ------------------------------------------------------------------ Recording

/**
 * Record one interaction. Best-effort by design: bots are dropped, repeats
 * inside the dedupe window are dropped, and any failure is logged and
 * swallowed. Callers deliberately do NOT await this.
 *
 * `ref` carries the ids resolved from the token — never rendered to the page.
 */
export async function recordTapEvent({ ref, type, target = null, req }) {
  try {
    if (!ref?.card) return;
    if (isBot(req.get('user-agent'))) return;

    const context = eventContext(req, ref.card);

    const window = DEDUPE_MS[type] ?? 0;
    if (window > 0) {
      const repeat = await NfcTapEvent.exists({
        card: ref.card,
        type,
        visitor: context.visitor,
        at: { $gte: new Date(Date.now() - window) },
      });
      if (repeat) return;
    }

    await NfcTapEvent.create({
      card: ref.card,
      employee: ref.employee ?? null,
      company: ref.company ?? null,
      type,
      target,
      ...context,
    });
  } catch (err) {
    // Never surface to the visitor — the page has already been served.
    logger.warn(`[nfc] tap event not recorded: ${err.message}`);
  }
}

// ----------------------------------------------------------------- Aggregation

/** The newest event for a filter, ignoring the window — "last tapped". */
async function lastEventAt(match) {
  const row = await NfcTapEvent.findOne(match).sort({ at: -1 }).select('at').lean();
  return row?.at ?? null;
}

/** Analytics for one card. */
export async function getCardAnalytics(cardId, { days }) {
  const card = await NfcCard.findById(cardId).select('_id').lean();
  if (!card) return null;

  const range = resolveRange(days);
  const match = { card: toId(cardId), at: { $gte: range.since } };

  const [facet] = await NfcTapEvent.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [{ $group: { _id: null, ...TYPE_COUNTS } }],
        unique: uniquePipeline,
        series: seriesPipeline,
        targets: targetsPipeline,
        countries: breakdown('country'),
        devices: breakdown('device', 3),
        platforms: breakdown('platform', 5),
        referrers: breakdown('referrerHost', 5),
      },
    },
  ]);

  return {
    days: range.days,
    totals: { ...totalsFrom(facet.totals), uniqueVisitors: facet.unique[0]?.n ?? 0 },
    series: fillSeries(facet.series, range),
    clicksByTarget: listFrom(facet.targets),
    countries: listFrom(facet.countries),
    devices: listFrom(facet.devices),
    platforms: listFrom(facet.platforms),
    referrers: listFrom(facet.referrers),
    lastEventAt: await lastEventAt({ card: toId(cardId) }),
  };
}

/** Analytics for one company, including a per-person breakdown. */
export async function getCompanyAnalytics(companyId, { days }) {
  const company = await NfcCompany.findById(companyId).select('_id').lean();
  if (!company) return null;

  const range = resolveRange(days);
  const match = { company: toId(companyId), at: { $gte: range.since } };

  const [facet] = await NfcTapEvent.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [{ $group: { _id: null, ...TYPE_COUNTS } }],
        unique: uniquePipeline,
        series: seriesPipeline,
        targets: targetsPipeline,
        countries: breakdown('country'),
        devices: breakdown('device', 3),
        byEmployee: [
          { $match: { employee: { $ne: null } } },
          { $group: { _id: '$employee', ...TYPE_COUNTS } },
          { $sort: { views: -1 } },
        ],
      },
    },
  ]);

  return {
    days: range.days,
    totals: { ...totalsFrom(facet.totals), uniqueVisitors: facet.unique[0]?.n ?? 0 },
    series: fillSeries(facet.series, range),
    clicksByTarget: listFrom(facet.targets),
    countries: listFrom(facet.countries),
    devices: listFrom(facet.devices),
    // The client merges these into the people list it already has.
    byEmployee: facet.byEmployee.map((r) => ({
      employee: r._id,
      views: r.views,
      saves: r.saves,
      images: r.images,
      clicks: r.clicks,
    })),
    lastEventAt: await lastEventAt({ company: toId(companyId) }),
  };
}

/** Platform-wide overview across every card. */
export async function getOverviewAnalytics({ days }) {
  const range = resolveRange(days);

  const [facet] = await NfcTapEvent.aggregate([
    { $match: { at: { $gte: range.since } } },
    {
      $facet: {
        totals: [{ $group: { _id: null, ...TYPE_COUNTS } }],
        unique: uniquePipeline,
        series: seriesPipeline,
        targets: targetsPipeline,
        countries: breakdown('country', 10),
        devices: breakdown('device', 3),
        platforms: breakdown('platform', 5),
        referrers: breakdown('referrerHost', 5),
        topCards: [
          { $group: { _id: '$card', ...TYPE_COUNTS } },
          { $sort: { views: -1 } },
          { $limit: 8 },
          { $lookup: { from: NfcCard.collection.name, localField: '_id', foreignField: '_id', as: 'card' } },
          { $unwind: '$card' },
          { $lookup: { from: NfcEmployee.collection.name, localField: 'card.employee', foreignField: '_id', as: 'employee' } },
          { $lookup: { from: NfcCompany.collection.name, localField: 'card.company', foreignField: '_id', as: 'company' } },
          {
            $project: {
              _id: 1,
              views: 1,
              saves: 1,
              images: 1,
              clicks: 1,
              token: '$card.token',
              status: '$card.status',
              employeeName: { $first: '$employee.name' },
              companyName: { $first: '$company.companyName' },
            },
          },
        ],
      },
    },
  ]);

  // How many cards are actually in play — context for the totals above.
  // cardsWithTaps is deliberately scoped to CURRENTLY active card ids, not
  // just "tapped in range": a card tapped while active and deactivated since
  // must not inflate this past activeCards (the sentence reads "X of Y active
  // cards", so X can never exceed Y).
  const activeCardIds = await NfcCard.find({ status: 'active' }).distinct('_id');
  const [cardsWithTaps, newest] = await Promise.all([
    NfcTapEvent.distinct('card', { at: { $gte: range.since }, card: { $in: activeCardIds } }).then(
      (ids) => ids.length
    ),
    lastEventAt({}),
  ]);
  const activeCards = activeCardIds.length;

  return {
    days: range.days,
    totals: { ...totalsFrom(facet.totals), uniqueVisitors: facet.unique[0]?.n ?? 0 },
    series: fillSeries(facet.series, range),
    clicksByTarget: listFrom(facet.targets),
    countries: listFrom(facet.countries),
    devices: listFrom(facet.devices),
    platforms: listFrom(facet.platforms),
    referrers: listFrom(facet.referrers),
    topCards: facet.topCards,
    activeCards,
    cardsWithTaps,
    lastEventAt: newest,
  };
}
