// Drafting a calendar from a whole programme, before anyone has said what they
// like.
//
// buildSchedule() answers "fit the shows I chose"; this answers the question a
// calendar-led planner asks instead — "every show is a candidate, so who gets
// 21:00 on Monday?" — and it answers it by scarcity: the contender with the
// fewest nights of its own takes the slot, because the one that plays again
// tomorrow can be caught tomorrow. A one-night-only show therefore beats a
// three-night one at the same hour, whatever either is.
//
// Nothing here knows which festival it is drafting, and nothing here touches
// the DOM: the slot shape, the clash rules and the travel maths are the
// engine's, and this module only decides who wins a contested hour and reports
// who lost it, so the surface above can offer the four verdicts back.
//
// Pure. Same inputs, same draft, every time.

import { compatible, eligibleSlots, normalizeMealBreaks, slotKey, withinDayWindow } from "./engine.js";

/**
 * Identity of one verdict against one performance: which show, which night.
 * The rejection sets are keyed by this, so rejecting Monday's showing of a run
 * leaves Tuesday's untouched.
 * @param {string} slug
 * @param {string} key a slotKey()
 * @returns {string}
 */
export function instanceKey(slug, key) {
  return `${slug}@${key}`;
}

/**
 * The order contenders are ranked in, and the whole of the selection rule:
 * fewest performances of its own first, then the earlier start, then the
 * earlier finish, then the slug — the last three only so that two shows of
 * equal scarcity draft the same way every time.
 * @param {{freedom: number, start: number, end: number, slug: string}} a
 * @param {{freedom: number, start: number, end: number, slug: string}} b
 * @returns {number}
 */
export function byScarcity(a, b) {
  return (
    a.freedom - b.freedom ||
    a.start - b.start ||
    a.end - b.end ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * Draft one performance per contested hour across the window, from every show
 * in the programme.
 *
 * Verdicts are honoured in the order they narrow the field: a rejected show
 * leaves the pool entirely, a rejected instance leaves that show's own pool, a
 * locked instance is placed before anything can take its hour, and a favourite
 * is placed before the unasked-for rest.
 *
 * @param {object[]} shows the whole catalogue
 * @param {{
 *   dateStart?: string, dateEnd?: string, windowStart?: string|Date, windowEnd?: string|Date,
 *   dayStartMin?: number, dayEndMin?: number,
 *   mealBreaks?: Array<object>, maxPerDay?: number,
 *   minGapSameVenue?: number, minGapDifferentVenue?: number, travelMode?: string,
 *   venueCoords?: Map<string,{lat:number,lng:number}>|object,
 *   locked?: Map<string,string>|Object<string,string>,
 *   favourites?: Set<string>|string[],
 *   rejectedShows?: Set<string>|string[],
 *   rejectedInstances?: Set<string>|string[],
 * }} [options]
 * @returns {{
 *   days: Array<{date: string, slots: object[]}>,
 *   picked: Map<string,string>,
 *   pool: Map<string, object[]>,
 *   crowdedOut: Array<{slug: string, title: string}>,
 *   counts: {candidates: number, contested: number, picked: number, shows: number},
 * }}
 */
export function draftCalendar(shows, options = {}) {
  const locked =
    options.locked instanceof Map
      ? new Map(options.locked)
      : new Map(Object.entries(options.locked ?? {}));
  const favourites = new Set(options.favourites ?? []);
  const rejectedShows = new Set(options.rejectedShows ?? []);
  const rejectedInstances = new Set(options.rejectedInstances ?? []);

  const gapOpts = {
    minGapSameVenue: options.minGapSameVenue,
    minGapDifferentVenue: options.minGapDifferentVenue,
    travelMode: options.travelMode,
  };
  const maxPerDay = options.maxPerDay ?? Infinity;
  const dayWindow = {
    dayStartMin: options.dayStartMin ?? 0,
    dayEndMin: options.dayEndMin ?? 1440,
    mealBreaks: normalizeMealBreaks(options.mealBreaks),
  };

  const inPlay = (shows || []).filter((s) => !rejectedShows.has(s.slug));
  const all = eligibleSlots(inPlay, {
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    venueCoords: options.venueCoords ?? null,
  });

  // A show's pool is its performances in the window that no verdict has struck
  // out. A locked instance overrides the day-hours window the way an explicit
  // pin does everywhere else: you asked for that hour by name.
  const pool = new Map();
  for (const [slug, slots] of all) {
    const pinnedKey = locked.get(slug);
    const kept = slots.filter((s) => {
      if (rejectedInstances.has(instanceKey(slug, slotKey(s)))) return false;
      if (pinnedKey && slotKey(s) === pinnedKey) return true;
      return withinDayWindow(s, dayWindow);
    });
    if (kept.length) pool.set(slug, kept);
  }

  // Scarcity is read off the pool, so it counts the nights still open to you
  // rather than the nights the programme printed: reject Monday's showing of a
  // three-night run and it competes as a two-night show from then on.
  const freedom = new Map();
  for (const [slug, slots] of pool) freedom.set(slug, slots.length);

  const candidates = [];
  for (const [slug, slots] of pool) {
    for (const slot of slots) {
      candidates.push({ ...slot, freedom: freedom.get(slug), contenders: [], verdict: null });
    }
  }
  candidates.sort(byScarcity);

  const placed = [];
  const placedShows = new Set();
  const perDay = new Map();

  const place = (cand, verdict) => {
    cand.verdict = verdict;
    placed.push(cand);
    placedShows.add(cand.slug);
    const day = perDay.get(cand.date) || [];
    day.push(cand);
    perDay.set(cand.date, day);
  };

  // A pass over an ordered set of candidates, taking the first of each show
  // that still fits. `capped` is false for the two verdict-driven passes: you
  // asked for these by name, so they are not the ones the per-day cap drops.
  const sweep = (list, verdict, capped) => {
    for (const cand of list) {
      if (placedShows.has(cand.slug)) continue;
      const sameDay = perDay.get(cand.date) || [];
      if (capped && sameDay.length >= maxPerDay) continue;
      if (!sameDay.every((c) => compatible(c, cand, gapOpts))) continue;
      place(cand, verdict);
    }
  };

  // Pass 1 — locked instances, earliest first so a pair of locks that clash
  // resolves the same way whichever order they were locked in.
  const lockedCands = candidates
    .filter((c) => locked.get(c.slug) === slotKey(c))
    .sort((a, b) => a.start - b.start || a.slug.localeCompare(b.slug));
  sweep(lockedCands, "locked", false);

  // Pass 2 — favourited shows: scarcest of their own remaining nights first.
  sweep(candidates.filter((c) => favourites.has(c.slug) && !placedShows.has(c.slug)), "favourite", false);

  // Pass 3 — the draft proper: the rest of the programme, scarcest first.
  sweep(candidates.filter((c) => !placedShows.has(c.slug)), "draft", true);

  // Everything that was never placed and shares an hour with something that
  // was is a contender the draft beat — what the block offers you instead.
  const placedAt = new Map();
  for (const cand of placed) placedAt.set(`${cand.date}T${cand.startMinuteOfDay}`, cand);
  const offered = new Set();
  for (const cand of candidates) {
    if (cand.verdict) continue;
    const winner = placedAt.get(`${cand.date}T${cand.startMinuteOfDay}`);
    if (!winner || winner.slug === cand.slug) continue;
    winner.contenders.push(cand);
    offered.add(cand.slug);
  }
  for (const cand of placed) cand.contenders.sort(byScarcity);

  // A show that lost every one of its nights to a clash rather than to a
  // shared hour is on no block at all — neither drafted nor offered as a
  // contender — so it is counted here rather than left to vanish between the
  // two.
  const crowdedOut = [];
  for (const [slug, slots] of pool) {
    if (placedShows.has(slug) || offered.has(slug)) continue;
    crowdedOut.push({ slug, title: slots[0].title });
  }

  const days = [...perDay.entries()]
    .map(([date, slots]) => ({ date, slots: [...slots].sort((a, b) => a.start - b.start || a.end - b.end) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    picked: new Map(placed.map((c) => [c.slug, slotKey(c)])),
    pool,
    crowdedOut,
    counts: {
      candidates: candidates.length,
      contested: placed.filter((c) => c.contenders.length).length,
      picked: placed.length,
      shows: pool.size,
    },
  };
}
