/* The trip's days as the reader shapes them, as rules: which day a first draft
 * keeps for something other than the festival, what a kept day or a block of
 * the reader's own lets the draft place, the hours a flight takes at either
 * end, and what a meal added at an hour is called.
 *
 * Hours are minutes from the festival night's midnight, the scale the draft's
 * slots use (`startMinuteOfDay`), so a night running past midnight goes on
 * counting past 24:00.
 *
 * Pure: no DOM, no storage.
 */

import { festivalOf } from "./pool.js";

/** The latest a night runs to: 06:00 the next morning. */
export const NIGHT_END_MIN = 30 * 60;

// From the airport to the first show, and from the last show to the airport.
export const TRANSFER_MIN = 90;
export const AIRPORT_MIN = 150;

/** What a show whose length is not published counts as against the day's hours. */
export const ASSUMED_LENGTH_MIN = 60;

/** What a kept day can be for; a day with none is a shows day. */
export const DAY_KINDS = ["rest", "excursion", "festival"];

/**
 * The day a first draft keeps: a festival nearby if the trip reaches one, on
 * the day it plays most; otherwise rest, on the day holding fewest shows that
 * play only that night. Neither the first nor the last day, which the flights
 * take, and nothing on a trip of fewer than three days.
 * @param {{dates: string[], lead: string|null, slots: Map<string, {date: string}[]>}} o
 *   slots: every show's performances in the trip, as the draft sees them
 * @returns {{date: string, kind: "rest"} | {date: string, kind: "festival", festival: string} | null}
 */
export function seedDay({ dates, lead, slots }) {
  if (dates.length < 3) return null;
  const inner = dates.slice(1, -1);
  const played = new Map(inner.map((d) => [d, 0]));
  const onlyTonight = new Map(inner.map((d) => [d, 0]));
  const nearby = new Map(); // festival -> Map(date -> performances)
  for (const [slug, list] of slots) {
    const festival = festivalOf(slug);
    const nights = new Set(list.map((s) => s.date));
    for (const s of list) {
      if (!played.has(s.date)) continue;
      played.set(s.date, played.get(s.date) + 1);
      if (festival !== lead) {
        const perDay = nearby.get(festival) || new Map();
        perDay.set(s.date, (perDay.get(s.date) || 0) + 1);
        nearby.set(festival, perDay);
      }
    }
    if (nights.size === 1) {
      const [only] = nights;
      if (onlyTonight.has(only)) onlyTonight.set(only, onlyTonight.get(only) + 1);
    }
  }
  const best = (entries, better) =>
    entries.reduce((a, b) => (a == null || better(b, a) ? b : a), null);

  if (nearby.size) {
    // The nearby festival with most performances in the trip, and its fullest day.
    const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
    const [festival, perDay] = best([...nearby].sort(([a], [b]) => a.localeCompare(b)), (x, y) => total(x[1]) > total(y[1]));
    const [date] = best(inner.filter((d) => perDay.get(d)).map((d) => [d, perDay.get(d)]), (x, y) => x[1] > y[1]);
    return { date, kind: "festival", festival };
  }
  const open = inner.filter((d) => played.get(d) > 0);
  if (!open.length) return null;
  const date = best(open, (x, y) => onlyTonight.get(x) < onlyTonight.get(y));
  return { date, kind: "rest" };
}

/**
 * Whether the draft may place a slot, given the days the reader kept and the
 * hours their own blocks take.
 * @param {Map<string, {kind: string, festival?: string}>} kept date -> what it is for
 * @param {Map<string, {startMin: number, endMin: number}[]>} busy date -> hours taken
 * @returns {(slot: {slug: string, date: string, startMinuteOfDay: number, endMinuteOfDay: number}) => boolean}
 */
export function slotRule(kept, busy) {
  return (slot) => {
    const day = kept.get(slot.date);
    if (day && day.kind !== "festival") return false;
    if (day && day.kind === "festival" && festivalOf(slot.slug) !== day.festival) return false;
    // Half-open, like a meal break: a show that ends as the block starts fits.
    return !(busy.get(slot.date) || []).some(
      (b) => slot.startMinuteOfDay < b.endMin && slot.endMinuteOfDay > b.startMin
    );
  };
}

/** Minutes from `dateISO`'s midnight to an instant, on `timeZone`'s wall clock. */
function minutesInto(dateISO, instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const [y, m, d] = dateISO.split("-").map(Number);
  return Math.round((wall - Date.UTC(y, m - 1, d)) / 60000);
}

/**
 * The hours a flight takes on the trip's first day (`out`: until it has landed
 * and the reader has got from the airport) or its last (`back`: from when they
 * must leave for the airport).
 * @param {"out"|"back"} which
 * @param {{departAt: string, durationMin: number|null}|null} flight
 * @param {string} dateISO the trip's first day for `out`, its last for `back`
 * @param {string} timeZone the festival's
 * @returns {{date: string, startMin: number, endMin: number}|null}
 */
export function flightHours(which, flight, dateISO, timeZone) {
  if (!flight || !dateISO) return null;
  const depart = new Date(flight.departAt);
  if (Number.isNaN(depart.getTime())) return null;
  if (which === "out") {
    const landed = new Date(depart.getTime() + (flight.durationMin || 0) * 60000);
    const endMin = Math.min(NIGHT_END_MIN, minutesInto(dateISO, landed, timeZone) + TRANSFER_MIN);
    return endMin <= 0 ? null : { date: dateISO, startMin: 0, endMin };
  }
  const startMin = Math.max(0, minutesInto(dateISO, depart, timeZone) - AIRPORT_MIN);
  return startMin >= NIGHT_END_MIN ? null : { date: dateISO, startMin, endMin: NIGHT_END_MIN };
}

/** The meals, in the order a day has them. */
export const MEALS = ["breakfast", "lunch", "dinner", "late", "snack"];

/**
 * What a meal added at an hour is: the meal of that time of day, or a snack
 * when the day already has it.
 * @param {number} min minutes from the night's midnight
 * @param {string[]} has the meals the day already holds
 */
export function mealAt(min, has = []) {
  const h = (((min % 1440) + 1440) % 1440) / 60;
  const meal = h >= 4 && h < 11 ? "breakfast" : h >= 11 && h < 16 ? "lunch" : h >= 16 && h < 22 ? "dinner" : "late";
  return has.includes(meal) ? "snack" : meal;
}
