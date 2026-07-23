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
import { travelMinutes, DEFAULT_TRAVEL_MODE } from "./travel.js";

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

// A Fringe evening runs past midnight: a performance that starts before this
// clock time (05:00) belongs to the PREVIOUS calendar day's festival night,
// drawn near the top of that day's 09:00–27:00 schedule column rather than at
// the bottom of its own morning. Folding adds 1440 to its minute-of-day (so
// 00:45 → 24:45) and re-dates it to the night before. 05:00 is a safe cutoff —
// nothing in the catalogue starts between 01:00 and 08:59.
export const NIGHT_FOLD_CUTOFF_MIN = 5 * 60;

/** Previous calendar day for a "YYYY-MM-DD" string (deterministic, no clock). */
function previousDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  const p2 = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}`;
}

/**
 * A performance's "festival night" placement. A show starting after midnight is
 * folded onto the previous evening: same real wall-clock start/end (kept for
 * exports and chronological ordering), but a festival date one day earlier and a
 * minute-of-day past 24:00 so it lands at the top of that night's column.
 * @param {string} date real "YYYY-MM-DD"
 * @param {number} startMinuteOfDay real minutes-since-midnight of the start
 * @param {number} cutoffMin fold shows starting before this clock minute
 * @returns {{festivalDate: string, festivalStartMinute: number}}
 */
export function festivalNight(date, startMinuteOfDay, cutoffMin = NIGHT_FOLD_CUTOFF_MIN) {
  if (startMinuteOfDay < cutoffMin) {
    return { festivalDate: previousDate(date), festivalStartMinute: startMinuteOfDay + 1440 };
  }
  return { festivalDate: date, festivalStartMinute: startMinuteOfDay };
}

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
 * @property {number} startMinuteOfDay minutes-since-midnight of the start
 * @property {number} endMinuteOfDay minutes-since-midnight of the end (capped at
 *   1440 for a performance that runs past midnight)
 * @property {string|null} status raw ticketStatus from shows.json (for display/colour)
 * @property {string|null} venueCode
 * @property {string|null} venueName
 * @property {number|null} venueLat
 * @property {number|null} venueLng
 * @property {string|null} room
 * @property {string|null} image
 * @property {string|null} blurb
 * @property {number|null} duration minutes
 * @property {string} url
 * @property {boolean} freeNonTicketed
 */

/** Resolve a venue code to {lat,lng} from a coords lookup (a Map or a plain
 *  object keyed by venue code), or null when unknown / an online venue. */
function lookupVenueCoord(venueCoords, code) {
  if (!venueCoords || code == null) return null;
  const key = String(code);
  const v = venueCoords instanceof Map ? venueCoords.get(key) : venueCoords[key];
  if (!v || v.lat == null || v.lng == null) return null;
  return { lat: v.lat, lng: v.lng };
}

/**
 * Per-show available performances that fit entirely inside the trip window.
 * Mirrors scheduling.py's `eligible_slots` (window + availability filter only
 * — gap/overlap compatibility and the day-hours/meal-break filter are separate
 * concerns, see `compatible` / `withinDayWindow`).
 *
 * @param {object[]} shows
 * @param {{windowStart?: string|Date, windowEnd?: string|Date,
 *          venueCoords?: Map<string,{lat:number,lng:number}>|object}} [options]
 *   venueCoords lets slots carry venue lat/lng so the scheduler can size
 *   different-venue gaps by real travel time and the UI can draw travel legs.
 * @returns {Map<string, Slot[]>}
 */
export function eligibleSlots(shows, options = {}) {
  const windowStart = toMinutes(options.windowStart ?? DEFAULT_WINDOW_START);
  const windowEnd = toMinutes(options.windowEnd ?? DEFAULT_WINDOW_END);
  const venueCoords = options.venueCoords ?? null;
  const cutoff = options.nightCutoffMin ?? NIGHT_FOLD_CUTOFF_MIN;
  // When date bounds are given, membership is by *festival* date (so a Friday
  // 00:45 late show counts as Friday night, and a show on the morning after the
  // last day does not leak in). Otherwise fall back to the epoch window filter.
  const byFestivalDate = options.dateStart != null && options.dateEnd != null;

  const out = new Map();
  for (const show of shows || []) {
    const coord = lookupVenueCoord(venueCoords, show.venue);
    const dur = show.duration || 0;
    const slots = [];
    for (const perf of show.performances || []) {
      if (!isAvailable(perf)) continue;
      const start = dateTimeToMinutes(perf.date, perf.start);
      const end = show.duration ? start + show.duration : start;
      const realStartMinute = timeToMinutesOfDay(perf.start);
      // Fold an after-midnight start onto the previous festival night: real
      // date/epoch are preserved (for exports + ordering) while the display
      // date and minute-of-day move to the night before.
      const { festivalDate, festivalStartMinute } = festivalNight(perf.date, realStartMinute, cutoff);
      if (byFestivalDate) {
        if (festivalDate < options.dateStart || festivalDate > options.dateEnd) continue;
      } else if (start < windowStart || end > windowEnd) {
        continue;
      }
      const startMinuteOfDay = festivalStartMinute;
      // The end-of-day is no longer capped at 24:00 — an evening show that runs
      // past midnight keeps its true length so the day-hours test and the
      // 09:00–27:00 axis can place and draw it honestly.
      const endMinuteOfDay = startMinuteOfDay + dur;
      slots.push({
        slug: show.slug,
        title: show.title,
        genre: show.genre ?? null,
        date: festivalDate,
        realDate: perf.date,
        startTime: perf.start,
        start,
        end,
        startMinuteOfDay,
        endMinuteOfDay,
        status: perf.status ?? null,
        venueCode: show.venue ?? null,
        venueName: show.venueName ?? null,
        venueLat: coord ? coord.lat : null,
        venueLng: coord ? coord.lng : null,
        room: show.room ?? null,
        image: show.image ?? show.smallImage ?? null,
        blurb: show.blurb ?? null,
        duration: show.duration ?? null,
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
 * Stable identity for one performance within a show: its real date + start time
 * ("YYYY-MM-DDTHH:MM"). The UI builds the same key from a favourite's raw
 * performance (date + start) so a "pin this exact performance" request lines up
 * with the slot the scheduler sees — one source of truth for both sides.
 * @param {{realDate?: string, date?: string, startTime?: string, start?: string}} p
 * @returns {string}
 */
export function slotKey(p) {
  const date = p.realDate ?? p.date;
  const start = p.startTime ?? p.start;
  return `${date}T${start}`;
}

/**
 * Normalize meal-break specs into `{startMin, endMin}` minute-of-day ranges,
 * dropping ones that are disabled (`enabled === false`), malformed, or
 * zero/negative length. Accepts `{startMin, endMin}` numbers or `{start, end}`
 * "HH:MM" strings.
 * @param {Array<{startMin?:number,endMin?:number,start?:string,end?:string,enabled?:boolean}>} breaks
 * @returns {Array<{startMin:number, endMin:number}>}
 */
export function normalizeMealBreaks(breaks) {
  if (!Array.isArray(breaks)) return [];
  const out = [];
  for (const b of breaks) {
    if (!b || b.enabled === false) continue;
    const startMin = b.startMin ?? (b.start != null ? timeToMinutesOfDay(b.start) : null);
    const endMin = b.endMin ?? (b.end != null ? timeToMinutesOfDay(b.end) : null);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    out.push({ startMin, endMin });
  }
  return out;
}

/**
 * True if a slot starts no earlier than the day start, ends no later than the
 * day end, and overlaps none of the meal breaks — the day-hours filter the
 * scheduler applies before allocating.
 * @param {Slot} slot
 * @param {{dayStartMin?:number, dayEndMin?:number, mealBreaks?:Array<{startMin:number,endMin:number}>}} [win]
 * @returns {boolean}
 */
export function withinDayWindow(slot, win = {}) {
  const dayStartMin = win.dayStartMin ?? 0;
  const dayEndMin = win.dayEndMin ?? 1440;
  if (slot.startMinuteOfDay < dayStartMin) return false;
  if (slot.endMinuteOfDay > dayEndMin) return false;
  for (const b of win.mealBreaks || []) {
    // Overlap (half-open): a show touching a break edge-to-edge is fine.
    if (slot.startMinuteOfDay < b.endMin && slot.endMinuteOfDay > b.startMin) return false;
  }
  return true;
}

/**
 * Minutes required between two slots. Same known venue → the same-venue buffer
 * (a double bill needs no travel). Different venues → the greater of the
 * different-venue buffer (a floor, also the value used when coordinates are
 * unknown) and the estimated door-to-door travel time by the chosen mode, so
 * the gap grows with distance and shrinks on a bike/car. Extends
 * scheduling.py's `required_gap_minutes` with the travel estimate.
 * @param {Slot} a
 * @param {Slot} b
 * @param {{minGapSameVenue?: number, minGapDifferentVenue?: number, travelMode?: string}} [options]
 * @returns {number}
 */
export function requiredGapMinutes(a, b, options = {}) {
  const minGapSameVenue = options.minGapSameVenue ?? DEFAULT_MIN_GAP_SAME_VENUE;
  const minGapDifferentVenue = options.minGapDifferentVenue ?? DEFAULT_MIN_GAP_DIFFERENT_VENUE;
  if (a.venueCode && b.venueCode && a.venueCode === b.venueCode) {
    return minGapSameVenue;
  }
  const t = travelMinutes(
    { lat: a.venueLat, lng: a.venueLng },
    { lat: b.venueLat, lng: b.venueLng },
    options.travelMode ?? DEFAULT_TRAVEL_MODE
  );
  if (t == null) return minGapDifferentVenue; // unknown coords — fall back to the flat buffer
  return Math.max(minGapDifferentVenue, Math.ceil(t));
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
 * required travel gap), at most `maxPerDay` shows on any one day, and only
 * performances that fall within the day-hours window and miss the meal breaks.
 *
 * The heuristic is classic earliest-finish-first activity selection — the
 * optimal greedy for "fit the most non-overlapping intervals on one machine" —
 * extended for this domain: once a show is placed, its other performances are
 * skipped (one-per-show), and a candidate is dropped if its day is already at
 * the per-day cap. Ties break deterministically (earliest start, then slug),
 * so the same inputs always yield the same plan — no wall-clock/random state.
 *
 * `forcedSlugs` are must-see shows placed in a first pass before the greedy
 * fill: each takes its earliest-finishing performance that doesn't clash with
 * another forced show, ignoring the per-day cap. The greedy pass then fills
 * around them, and the min-per-day post-pass never drops a day that holds a
 * forced show.
 *
 * `forcedPerformances` pins a must-see to one *specific* performance (keyed by
 * `slotKey`, "YYYY-MM-DDTHH:MM") rather than letting pass 1 pick. A pinned slug
 * is forced automatically (no need to also list it in `forcedSlugs`), and its
 * chosen performance is honoured even if the day-hours window or a meal break
 * would otherwise filter it out — the user asked for exactly this one. It can
 * still be displaced only by a hard clash with another must-see.
 *
 * `minPerDay` is applied as a post-pass: a day holding fewer than the minimum
 * (and no forced show) is dropped whole (you don't trek into town for a single
 * show), and its shows fall back to `unscheduled` with a "below your minimum"
 * reason. Leave it at 1 (the default) to keep every day.
 *
 * @param {object[]} shows shows to schedule (typically matchFavourites(...).matched)
 * @param {{
 *   windowStart?: string|Date, windowEnd?: string|Date,
 *   minGapSameVenue?: number, minGapDifferentVenue?: number,
 *   travelMode?: string, venueCoords?: Map<string,{lat:number,lng:number}>|object,
 *   dayStartMin?: number, dayEndMin?: number,
 *   mealBreaks?: Array<{startMin?:number,endMin?:number,start?:string,end?:string,enabled?:boolean}>,
 *   maxPerDay?: number, minPerDay?: number, forcedSlugs?: string[]|Set<string>,
 *   forcedPerformances?: Map<string,string>|Object<string,string>,
 * }} [options]
 * @returns {{
 *   days: Array<{date: string, slots: Slot[]}>,
 *   scheduled: Slot[],
 *   unscheduled: Array<{slug: string, title: string, reason: string}>,
 *   forced: string[],
 *   counts: {matchedShows: number, scheduledShows: number, days: number},
 * }}
 */
export function buildSchedule(shows, options = {}) {
  const windowStart = options.windowStart ?? DEFAULT_WINDOW_START;
  const windowEnd = options.windowEnd ?? DEFAULT_WINDOW_END;
  const gapOpts = {
    minGapSameVenue: options.minGapSameVenue ?? DEFAULT_MIN_GAP_SAME_VENUE,
    minGapDifferentVenue: options.minGapDifferentVenue ?? DEFAULT_MIN_GAP_DIFFERENT_VENUE,
    travelMode: options.travelMode ?? DEFAULT_TRAVEL_MODE,
  };
  const maxPerDay = options.maxPerDay ?? Infinity;
  const minPerDay = options.minPerDay ?? 1;
  const dayWindow = {
    dayStartMin: options.dayStartMin ?? 0,
    dayEndMin: options.dayEndMin ?? 1440,
    mealBreaks: normalizeMealBreaks(options.mealBreaks),
  };
  // Pinned-to-a-specific-performance must-sees (slug -> slotKey). A pinned slug
  // is forced too, so fold its keys into forcedSlugs.
  const forcedPerformances =
    options.forcedPerformances instanceof Map
      ? new Map(options.forcedPerformances)
      : new Map(Object.entries(options.forcedPerformances ?? {}));
  const forcedSlugs = new Set(options.forcedSlugs ?? []);
  for (const slug of forcedPerformances.keys()) forcedSlugs.add(slug);

  // Every window+availability slot (with coords + minute-of-day annotations)…
  const slotsByShowAll = eligibleSlots(shows, {
    windowStart,
    windowEnd,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    venueCoords: options.venueCoords ?? null,
  });
  // …then narrowed to those inside the day-hours window and clear of meal
  // breaks. `lostToDayWindow` remembers shows that had window slots but lost
  // them all to that filter, for an honest unscheduled reason.
  // Optional per-date "getting there" / "getting out" blocks. On the arrival
  // date the block *replaces* the day-start, so day one can begin earlier (or
  // later) than the rest of the trip: nothing starts before `arrival.endMin`.
  // On the departure date it replaces the day-end: nothing runs past
  // `departure.startMin`. Modelled as date-specific meal breaks so they ride the
  // same day-window filter (and, like meal breaks, an explicit performance pin
  // still overrides them via slotsByShowAll).
  const arrival = options.arrival && options.arrival.endMin != null ? options.arrival : null;
  const departure = options.departure && options.departure.startMin != null ? options.departure : null;
  const windowForDate = (date) => {
    const isArrival = arrival && arrival.date === date;
    const isDeparture = departure && departure.date === date;
    if (!isArrival && !isDeparture) return dayWindow;
    const w = { ...dayWindow, mealBreaks: dayWindow.mealBreaks.slice() };
    if (isArrival) {
      w.dayStartMin = 0; // the getting-there block owns day one's start
      w.mealBreaks.push({ startMin: 0, endMin: arrival.endMin });
    }
    if (isDeparture) {
      w.dayEndMin = Infinity; // the getting-out block owns the last day's end
      w.mealBreaks.push({ startMin: departure.startMin, endMin: Infinity });
    }
    return w;
  };
  const slotsByShow = new Map();
  for (const [slug, slots] of slotsByShowAll) {
    slotsByShow.set(slug, slots.filter((s) => withinDayWindow(s, windowForDate(s.date))));
  }

  const chosen = [];
  const placedShows = new Set();
  const forcedPlaced = new Set();
  const perDay = new Map(); // date -> Slot[] placed that day

  const place = (slot, isForced) => {
    chosen.push(slot);
    placedShows.add(slot.slug);
    if (isForced) forcedPlaced.add(slot.slug);
    const day = perDay.get(slot.date) || [];
    day.push(slot);
    perDay.set(slot.date, day);
  };

  // --- Pass 1: forced (must-see) shows claim their slot first --------------
  // Stable slug order so the plan is reproducible. Each forced show takes the
  // earliest-finishing performance compatible with the forced shows already
  // placed; it ignores the per-day cap (you insisted on it) but still can't
  // overlap another must-see.
  for (const slug of [...forcedSlugs].sort()) {
    const pinnedKey = forcedPerformances.get(slug);
    let slots;
    if (pinnedKey) {
      // Pinned to one exact performance: take it straight from the full window
      // set (pre day-hours filter) so an explicit pin overrides day hours and
      // meal breaks. Only a hard must-see clash can still bump it.
      const match = (slotsByShowAll.get(slug) || []).find((s) => slotKey(s) === pinnedKey);
      slots = match ? [match] : [];
    } else {
      // Whole show forced: prefer a performance that fits the day-hours window
      // and dodges meal breaks, but a must-see must still land — so fall back to
      // any in-window performance, overriding those blocks (the same override an
      // explicit performance pin gets). Unblocked slots are tried first, then
      // blocked ones, each group earliest-finishing.
      const byEnd = (a, b) => a.end - b.end || a.start - b.start;
      const unblocked = [...(slotsByShow.get(slug) || [])].sort(byEnd);
      const unblockedKeys = new Set(unblocked.map(slotKey));
      const blocked = [...(slotsByShowAll.get(slug) || [])]
        .filter((s) => !unblockedKeys.has(slotKey(s)))
        .sort(byEnd);
      slots = [...unblocked, ...blocked];
    }
    for (const slot of slots) {
      const sameDay = perDay.get(slot.date) || [];
      if (sameDay.every((c) => compatible(c, slot, gapOpts))) {
        place(slot, true);
        break;
      }
    }
  }

  // --- Pass 2: greedy earliest-finish for everything else ------------------
  const candidates = [];
  for (const [slug, slots] of slotsByShow) {
    if (forcedSlugs.has(slug)) continue; // handled in pass 1
    for (const slot of slots) candidates.push(slot);
  }
  candidates.sort(
    (a, b) =>
      a.end - b.end ||
      a.start - b.start ||
      a.slug.localeCompare(b.slug) ||
      a.date.localeCompare(b.date)
  );
  for (const slot of candidates) {
    if (placedShows.has(slot.slug)) continue; // one performance per show
    const sameDay = perDay.get(slot.date) || [];
    if (sameDay.length >= maxPerDay) continue; // day already full
    if (!sameDay.every((c) => compatible(c, slot, gapOpts))) continue; // clash
    place(slot, false);
  }

  // Post-pass: drop under-populated days (min-per-day preference), but never a
  // day that holds a forced show.
  const droppedShows = new Set();
  for (const [date, slots] of perDay) {
    if (slots.length >= minPerDay) continue;
    if (slots.some((s) => forcedPlaced.has(s.slug))) continue;
    for (const slot of slots) droppedShows.add(slot.slug);
    perDay.delete(date);
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
    const windowSlots = (slotsByShowAll.get(show.slug) || []).length;
    const daySlots = (slotsByShow.get(show.slug) || []).length;
    // A pinned show overrides the day-hours filter, so if its exact performance
    // exists in the window yet didn't place, the cause is a must-see clash — not
    // a day-hours problem, even when the day-filtered pool is empty.
    const pinnedInWindow =
      forcedPerformances.has(show.slug) &&
      windowSlots > 0 &&
      (slotsByShowAll.get(show.slug) || []).some((s) => slotKey(s) === forcedPerformances.get(show.slug));
    let reason;
    if (windowSlots === 0) reason = "no available performance in your dates";
    else if (pinnedInWindow) reason = "forced, but it clashes with another must-see";
    else if (daySlots === 0) reason = "only runs outside your day hours or meal breaks";
    else if (droppedShows.has(show.slug)) reason = "on a day below your minimum";
    else if (forcedSlugs.has(show.slug)) reason = "forced, but it clashes with another must-see";
    else reason = "clashes with shows already in your plan";
    unscheduled.push({ slug: show.slug, title: show.title, reason });
  }

  return {
    days,
    scheduled,
    unscheduled,
    forced: [...forcedPlaced],
    counts: {
      matchedShows: (shows || []).length,
      scheduledShows: scheduled.length,
      days: days.length,
    },
  };
}

/**
 * Which day-hours / meal-break controls are, on their own, making a show
 * un-placeable. A show counts as blocked when it has at least one available
 * performance inside the date window but none survive the day-hours + meal
 * filter. For each such show we attribute blame to every control that would —
 * on its own, all others left as-is — rescue at least one performance if
 * relaxed. So a control's list is exactly "the shows this control shuts out",
 * ready for a "prevents N shows" label + tooltip and an at-a-glance grid mark.
 *
 * @param {object[]} shows shows to diagnose (typically the matched favourites)
 * @param {{
 *   dateStart: string, dateEnd: string,
 *   dayStartMin?: number, dayEndMin?: number, dayEndCeil?: number,
 *   mealBreaks?: Array<{id?:string, startMin?:number, endMin?:number, start?:string, end?:string, enabled?:boolean}>,
 *   venueCoords?: Map<string,{lat:number,lng:number}>|object,
 * }} options
 * @returns {{
 *   blockedSlugs: Set<string>,
 *   dayStart: Array<{slug:string,title:string}>,
 *   dayEnd: Array<{slug:string,title:string}>,
 *   meals: Object<string, Array<{slug:string,title:string}>>,
 * }}
 */
export function placementDiagnostics(shows, options = {}) {
  const dayStartMin = options.dayStartMin ?? 0;
  const dayEndMin = options.dayEndMin ?? 1440;
  const dayEndCeil = options.dayEndCeil ?? 1620; // 27:00 — the axis' late edge
  // Enabled meal breaks, keeping their ids for per-control attribution.
  const meals = (options.mealBreaks || [])
    .filter((m) => m && m.enabled !== false)
    .map((m) => ({
      id: m.id || "meal",
      startMin: m.startMin ?? (m.start != null ? timeToMinutesOfDay(m.start) : null),
      endMin: m.endMin ?? (m.end != null ? timeToMinutesOfDay(m.end) : null),
    }))
    .filter((m) => m.startMin != null && m.endMin != null && m.endMin > m.startMin);

  const baseWin = { dayStartMin, dayEndMin, mealBreaks: meals };
  const slotsByShow = eligibleSlots(shows, {
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    venueCoords: options.venueCoords ?? null,
  });

  const result = { blockedSlugs: new Set(), dayStart: [], dayEnd: [], meals: {} };
  for (const m of meals) result.meals[m.id] = [];

  for (const show of shows || []) {
    const slots = slotsByShow.get(show.slug) || [];
    if (slots.length === 0) continue; // nothing in the date window — a dates problem, not a day-hours one
    if (slots.some((s) => withinDayWindow(s, baseWin))) continue; // already placeable
    result.blockedSlugs.add(show.slug);
    const entry = { slug: show.slug, title: show.title };

    // A control is culpable if relaxing only it would let a performance back in.
    if (slots.some((s) => withinDayWindow(s, { ...baseWin, dayStartMin: 0 }))) {
      result.dayStart.push(entry);
    }
    if (slots.some((s) => withinDayWindow(s, { ...baseWin, dayEndMin: dayEndCeil }))) {
      result.dayEnd.push(entry);
    }
    for (const m of meals) {
      const without = meals.filter((x) => x.id !== m.id);
      if (slots.some((s) => withinDayWindow(s, { ...baseWin, mealBreaks: without }))) {
        result.meals[m.id].push(entry);
      }
    }
  }
  return result;
}
