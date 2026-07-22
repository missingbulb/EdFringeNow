// Main API the UI calls: matching favourites against the show catalogue,
// summarizing availability within a date/time window, and (for later use) the
// scheduling primitives ported from edfringe/scheduling.py.
//
// Pure — no DOM, no fetch. The UI is responsible for loading data/normalized/
// shows.json and the favourites file text and passing them in.

import { urlFromSlug } from "./favourites.js";
import {
  isAvailable,
  isNonTicketed,
  dateTimeToMinutes,
  timeToMinutesOfDay,
} from "./availability.js";

// --- indexing / matching --------------------------------------------------

/**
 * Index shows by slug for O(1) favourite lookup.
 * @param {object[]} shows shows.json array
 * @returns {Map<string, object>}
 */
export function buildIndex(shows) {
  const index = new Map();
  for (const show of shows || []) {
    if (show && show.slug) index.set(show.slug, show);
  }
  return index;
}

/**
 * Resolve favourite slugs against the show index.
 * @param {string[]} slugs de-duplicated slugs from parseFavourites
 * @param {Map<string, object>} index from buildIndex
 * @returns {{matched: object[], missingSlugs: string[]}}
 */
export function matchFavourites(slugs, index) {
  const matched = [];
  const missingSlugs = [];
  for (const slug of slugs || []) {
    const show = index.get(slug);
    if (show) matched.push(show);
    else missingSlugs.push(slug);
  }
  return { matched, missingSlugs };
}

// --- summarizing availability within a window -----------------------------

/**
 * Normalize a startTimeMin/Max filter bound to minutes-since-midnight: pass
 * through a number as-is, or parse an "HH:MM" string.
 * @param {number|string} bound
 * @returns {number}
 */
function normalizeTimeBound(bound) {
  if (typeof bound === "number") return bound;
  if (typeof bound === "string") return timeToMinutesOfDay(bound);
  throw new TypeError(`Expected number or "HH:MM" string, got ${JSON.stringify(bound)}`);
}

/**
 * Annotate every performance of every show against a date/time-of-day window,
 * and roll up summary counts.
 *
 * @param {object[]} shows shows to summarize (typically matchFavourites(...).matched)
 * @param {{dateStart: string, dateEnd: string, startTimeMin: number|string, startTimeMax: number|string}} filter
 *   dateStart/dateEnd are "YYYY-MM-DD" (inclusive). startTimeMin/startTimeMax are
 *   either minutes-since-midnight or "HH:MM" strings (inclusive).
 * @param {number} [totalFavourites] total favourite slugs before matching (defaults
 *   to shows.length when the caller only has the matched set on hand).
 * @returns {{
 *   counts: {totalFavourites: number, matchedShows: number, showsAvailableInWindow: number},
 *   shows: Array<{
 *     slug: string, title: string,
 *     performances: Array<{date: string, start: string, available: boolean, status: string|null, soldOut: boolean, inWindow: boolean}>,
 *     availableDateSpan: {min: string, max: string} | null,
 *   }>,
 * }}
 */
export function summarize(shows, filter, totalFavourites) {
  const dateStart = filter.dateStart;
  const dateEnd = filter.dateEnd;
  const startTimeMin = normalizeTimeBound(filter.startTimeMin);
  const startTimeMax = normalizeTimeBound(filter.startTimeMax);

  const summarizedShows = (shows || []).map((show) => {
    let availableMin = null;
    let availableMax = null;
    let hasInWindow = false;

    const performances = (show.performances || []).map((perf) => {
      const available = isAvailable(perf);
      if (available) {
        if (availableMin === null || perf.date < availableMin) availableMin = perf.date;
        if (availableMax === null || perf.date > availableMax) availableMax = perf.date;
      }
      const dateInRange = perf.date >= dateStart && perf.date <= dateEnd;
      const startMinOfDay = timeToMinutesOfDay(perf.start);
      const timeInRange = startMinOfDay >= startTimeMin && startMinOfDay <= startTimeMax;
      const inWindow = available && dateInRange && timeInRange;
      if (inWindow) hasInWindow = true;
      return {
        date: perf.date,
        start: perf.start,
        available,
        status: perf.status ?? null,
        soldOut: !!perf.soldOut,
        inWindow,
      };
    });

    return {
      slug: show.slug,
      title: show.title,
      performances,
      availableDateSpan: availableMin ? { min: availableMin, max: availableMax } : null,
      _hasInWindow: hasInWindow, // internal, stripped before returning below
    };
  });

  const showsAvailableInWindow = summarizedShows.filter((s) => s._hasInWindow).length;
  for (const s of summarizedShows) delete s._hasInWindow;

  return {
    counts: {
      totalFavourites: totalFavourites ?? (shows ? shows.length : 0),
      matchedShows: shows ? shows.length : 0,
      showsAvailableInWindow,
    },
    shows: summarizedShows,
  };
}

// --- scheduling primitives (for later use) ---------------------------------
// Ported from edfringe/scheduling.py. Default trip window and gap match the
// Python module's defaults for 2026; all are overridable parameters here
// rather than module-level globals (Python's `configure()`).

export const DEFAULT_WINDOW_START = "2026-08-07T15:00";
export const DEFAULT_WINDOW_END = "2026-08-24T17:00";
export const DEFAULT_MIN_GAP_SAME_VENUE = 0;
export const DEFAULT_MIN_GAP_DIFFERENT_VENUE = 30;

/**
 * Parse a "YYYY-MM-DDTHH:MM" (or Date) into minutes-since-epoch, consistent
 * with availability.js's wall-clock minute counting.
 * @param {string|Date} value
 * @returns {number}
 */
function toMinutes(value) {
  if (value instanceof Date) return value.getTime() / 60000;
  const [date, time] = value.split("T");
  return dateTimeToMinutes(date, time || "00:00");
}

/**
 * One bookable performance of a show, eligible for scheduling. Mirrors
 * scheduling.py's Slot dataclass, adapted to shows.json's fields (venueCode
 * from `show.venue`, no separate various-venue flag in this dataset).
 * @typedef {object} Slot
 * @property {string} slug
 * @property {string} title
 * @property {string|null} genre
 * @property {string} date
 * @property {string} startTime "HH:MM"
 * @property {number} start minutes since epoch
 * @property {number} end minutes since epoch
 * @property {string|null} status raw ticketStatus from shows.json (for display/colour)
 * @property {string|null} venueCode
 * @property {string|null} venueName
 * @property {string|null} room
 * @property {string} url
 * @property {boolean} freeNonTicketed
 */

/**
 * Per-show available performances that fit entirely inside the trip window.
 * Mirrors scheduling.py's `eligible_slots` (window + availability filter only
 * — gap/overlap compatibility is a separate concern, see `compatible`).
 *
 * @param {object[]} shows
 * @param {{windowStart?: string|Date, windowEnd?: string|Date, minGap?: number}} [options]
 *   minGap is accepted for API symmetry with the gap-aware helpers below but is
 *   not applied here (Python's eligible_slots doesn't gap-filter either — that
 *   happens when building a schedule from the slots).
 * @returns {Map<string, Slot[]>}
 */
export function eligibleSlots(shows, options = {}) {
  const windowStart = toMinutes(options.windowStart ?? DEFAULT_WINDOW_START);
  const windowEnd = toMinutes(options.windowEnd ?? DEFAULT_WINDOW_END);

  const out = new Map();
  for (const show of shows || []) {
    const slots = [];
    for (const perf of show.performances || []) {
      if (!isAvailable(perf)) continue;
      const start = dateTimeToMinutes(perf.date, perf.start);
      const end = show.duration ? start + show.duration : start;
      if (start < windowStart || end > windowEnd) continue;
      slots.push({
        slug: show.slug,
        title: show.title,
        genre: show.genre ?? null,
        date: perf.date,
        startTime: perf.start,
        start,
        end,
        status: perf.status ?? null,
        venueCode: show.venue ?? null,
        venueName: show.venueName ?? null,
        room: show.room ?? null,
        url: urlFromSlug(show.slug),
        freeNonTicketed: isNonTicketed(perf),
      });
    }
    slots.sort((a, b) => a.start - b.start || a.end - b.end);
    out.set(show.slug, slots);
  }
  return out;
}

/**
 * Minutes required between two slots: the same-venue buffer when both share a
 * known venue code, otherwise the different-venue buffer. Mirrors
 * scheduling.py's `required_gap_minutes`.
 * @param {Slot} a
 * @param {Slot} b
 * @param {{minGapSameVenue?: number, minGapDifferentVenue?: number}} [options]
 * @returns {number}
 */
export function requiredGapMinutes(a, b, options = {}) {
  const minGapSameVenue = options.minGapSameVenue ?? DEFAULT_MIN_GAP_SAME_VENUE;
  const minGapDifferentVenue = options.minGapDifferentVenue ?? DEFAULT_MIN_GAP_DIFFERENT_VENUE;
  if (a.venueCode && b.venueCode && a.venueCode === b.venueCode) {
    return minGapSameVenue;
  }
  return minGapDifferentVenue;
}

/**
 * True if both performances can be attended: no overlap, and at least the
 * required travel-buffer gap between them. Mirrors scheduling.py's `compatible`.
 * @param {Slot} a
 * @param {Slot} b
 * @param {{minGapSameVenue?: number, minGapDifferentVenue?: number}} [options]
 * @returns {boolean}
 */
export function compatible(a, b, options = {}) {
  const [earlier, later] = a.start <= b.start ? [a, b] : [b, a];
  return later.start >= earlier.end + requiredGapMinutes(earlier, later, options);
}

// --- building an itinerary from the eligible slots ------------------------

/**
 * Greedily allocate a conflict-free itinerary: at most one performance per
 * show, no two performances on the same day overlapping (or closer than the
 * required travel buffer), and at most `maxPerDay` shows on any one day.
 *
 * The heuristic is classic earliest-finish-first activity selection — the
 * optimal greedy for "fit the most non-overlapping intervals on one machine" —
 * extended for this domain: once a show is placed, its other performances are
 * skipped (one-per-show), and a candidate is dropped if its day is already at
 * the per-day cap. Ties break deterministically (earliest start, then slug),
 * so the same inputs always yield the same plan — no wall-clock/random state.
 *
 * `minPerDay` is applied as a post-pass: a day holding fewer than the minimum
 * is dropped whole (you don't trek into town for a single show), and its shows
 * fall back to `unscheduled` with a "below your minimum" reason. Leave it at 1
 * (the default) to keep every day.
 *
 * @param {object[]} shows shows to schedule (typically matchFavourites(...).matched)
 * @param {{
 *   windowStart?: string|Date, windowEnd?: string|Date,
 *   minGapSameVenue?: number, minGapDifferentVenue?: number,
 *   maxPerDay?: number, minPerDay?: number,
 * }} [options]
 * @returns {{
 *   days: Array<{date: string, slots: Slot[]}>,
 *   scheduled: Slot[],
 *   unscheduled: Array<{slug: string, title: string, reason: string}>,
 *   counts: {matchedShows: number, scheduledShows: number, days: number},
 * }}
 */
export function buildSchedule(shows, options = {}) {
  const windowStart = options.windowStart ?? DEFAULT_WINDOW_START;
  const windowEnd = options.windowEnd ?? DEFAULT_WINDOW_END;
  const gapOpts = {
    minGapSameVenue: options.minGapSameVenue ?? DEFAULT_MIN_GAP_SAME_VENUE,
    minGapDifferentVenue: options.minGapDifferentVenue ?? DEFAULT_MIN_GAP_DIFFERENT_VENUE,
  };
  const maxPerDay = options.maxPerDay ?? Infinity;
  const minPerDay = options.minPerDay ?? 1;

  const slotsByShow = eligibleSlots(shows, { windowStart, windowEnd });

  // All candidate performances, earliest-finishing first (ties: earliest
  // start, then slug/date for a stable, reproducible order).
  const candidates = [];
  for (const slots of slotsByShow.values()) {
    for (const slot of slots) candidates.push(slot);
  }
  candidates.sort(
    (a, b) =>
      a.end - b.end ||
      a.start - b.start ||
      a.slug.localeCompare(b.slug) ||
      a.date.localeCompare(b.date)
  );

  const chosen = [];
  const placedShows = new Set();
  const perDay = new Map(); // date -> Slot[] placed that day

  for (const slot of candidates) {
    if (placedShows.has(slot.slug)) continue; // one performance per show
    const sameDay = perDay.get(slot.date) || [];
    if (sameDay.length >= maxPerDay) continue; // day already full
    if (!sameDay.every((c) => compatible(c, slot, gapOpts))) continue; // clash
    chosen.push(slot);
    placedShows.add(slot.slug);
    sameDay.push(slot);
    perDay.set(slot.date, sameDay);
  }

  // Post-pass: drop under-populated days (min-per-day preference).
  const droppedShows = new Set();
  for (const [date, slots] of perDay) {
    if (slots.length < minPerDay) {
      for (const slot of slots) droppedShows.add(slot.slug);
      perDay.delete(date);
    }
  }

  const days = [...perDay.entries()]
    .map(([date, slots]) => ({
      date,
      slots: [...slots].sort((a, b) => a.start - b.start || a.end - b.end),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const scheduled = days.flatMap((d) => d.slots);
  const scheduledSlugs = new Set(scheduled.map((s) => s.slug));

  const unscheduled = [];
  for (const show of shows || []) {
    if (scheduledSlugs.has(show.slug)) continue;
    const hadSlots = (slotsByShow.get(show.slug) || []).length > 0;
    let reason;
    if (!hadSlots) reason = "no available performance in your dates";
    else if (droppedShows.has(show.slug)) reason = "on a day below your minimum";
    else reason = "clashes with shows already in your plan";
    unscheduled.push({ slug: show.slug, title: show.title, reason });
  }

  return {
    days,
    scheduled,
    unscheduled,
    counts: {
      matchedShows: (shows || []).length,
      scheduledShows: scheduled.length,
      days: days.length,
    },
  };
}
