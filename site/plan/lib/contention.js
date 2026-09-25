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
 * `preferred` is weaker than any of them and is not a verdict: a taste the
 * reader stated, which orders the last pass and caps how much of a day may
 * come from outside it. It narrows nothing — an hour no preferred show wants
 * is still filled, up to that cap.
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
 *   preferred?: Set<string>|string[],
 *   maxUnpreferredPerDay?: number,
 *   allowSlot?: (slot: object) => boolean,
 * }} [options]
 *   allowSlot: what the reader has kept for themselves — a performance it
 *   refuses leaves the pool the way one outside the day's hours does.
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
  const preferred = new Set(options.preferred ?? []);
  // No stated taste means no cap: every show is as welcome as every other, so
  // an unpreferred-per-day limit would be a limit on nothing.
  const maxUnpreferredPerDay = preferred.size
    ? options.maxUnpreferredPerDay ?? Infinity
    : Infinity;

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
      if (options.allowSlot && !options.allowSlot(s)) return false;
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
  // Counted separately from the day's length, because the two caps answer
  // different questions: how full a day is, and how much of it is outside what
  // the reader came for.
  const unpreferredPerDay = new Map();

  const place = (cand, verdict) => {
    cand.verdict = verdict;
    placed.push(cand);
    placedShows.add(cand.slug);
    const day = perDay.get(cand.date) || [];
    day.push(cand);
    perDay.set(cand.date, day);
    if (!preferred.has(cand.slug)) {
      unpreferredPerDay.set(cand.date, (unpreferredPerDay.get(cand.date) || 0) + 1);
    }
  };

  // A pass over an ordered set of candidates, taking the first of each show
  // that still fits. `dayCap` is "how full a day", which only a lock — an hour
  // asked for by name — overrides; a favourite says you want the show, not that
  // it outranks the day you described. `tasteCap` is the limit on shows from
  // outside your kinds, which neither verdict is held to.
  const sweep = (list, verdict, dayCap, tasteCap) => {
    for (const cand of list) {
      if (placedShows.has(cand.slug)) continue;
      const sameDay = perDay.get(cand.date) || [];
      if (dayCap && sameDay.length >= maxPerDay) continue;
      if (
        tasteCap &&
        !preferred.has(cand.slug) &&
        (unpreferredPerDay.get(cand.date) || 0) >= maxUnpreferredPerDay
      ) {
        continue;
      }
      if (!sameDay.every((c) => compatible(c, cand, gapOpts))) continue;
      place(cand, verdict);
    }
  };

  // Pass 1 — locked instances, earliest first so a pair of locks that clash
  // resolves the same way whichever order they were locked in.
  const lockedCands = candidates
    .filter((c) => locked.get(c.slug) === slotKey(c))
    .sort((a, b) => a.start - b.start || a.slug.localeCompare(b.slug));
  sweep(lockedCands, "locked", false, false);

  // Pass 2 — favourited shows: scarcest of their own remaining nights first.
  sweep(candidates.filter((c) => favourites.has(c.slug) && !placedShows.has(c.slug)), "favourite", true, false);

  // Pass 3 — the kinds the reader said they came for, scarcest first, so a
  // contested hour goes to one of them over an equally scarce show they never
  // asked about.
  sweep(candidates.filter((c) => preferred.has(c.slug) && !placedShows.has(c.slug)), "draft", true, true);

  // Pass 4 — the draft proper: the rest of the programme, scarcest first, held
  // to whatever of the day is left for shows outside the reader's taste.
  sweep(candidates.filter((c) => !placedShows.has(c.slug)), "draft", true, true);

  // What a block offers instead of itself: the shows that wanted the same hour
  // and could still take it. Three things disqualify a contender, and all three
  // are settled here rather than discovered after the reader has picked one.
  const placedAt = new Map();
  for (const cand of placed) placedAt.set(`${cand.date}T${cand.startMinuteOfDay}`, cand);
  const offered = new Set();
  for (const cand of candidates) {
    const winner = placedAt.get(`${cand.date}T${cand.startMinuteOfDay}`);
    if (!winner || winner.slug === cand.slug) continue;
    // 1. The reader has settled this hour, so nothing is on offer for it.
    if (winner.verdict === "locked") continue;
    // 2. The show is already in the calendar on another night. Offering it here
    //    would be offering to MOVE it, which is not what the picker says it does.
    if (placedShows.has(cand.slug)) continue;
    // 3. It could not be reached from what the reader has already committed to
    //    that night — the walk between the venues plus the rest they asked for
    //    between shows, the same rules the draft itself obeys. Measured against
    //    the night's LOCKED and FAVOURITED shows only: taking a contender
    //    re-drafts the evening, and everything the draft merely guessed at is
    //    free to move out of the way, so guarding those would refuse almost
    //    every offer to protect a choice nobody made.
    const committed = (perDay.get(cand.date) || []).filter(
      (c) => c !== winner && (c.verdict === "locked" || c.verdict === "favourite")
    );
    if (!committed.every((c) => compatible(c, cand, gapOpts))) continue;
    winner.contenders.push(cand);
    offered.add(cand.slug);
  }
  for (const cand of placed) cand.contenders.sort(byScarcity);

  // A show nothing drafted and no block offers is on the calendar nowhere at
  // all, so it is counted rather than left to vanish between the two.
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
