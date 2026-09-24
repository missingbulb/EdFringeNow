/* Which festivals a reader can actually get to, and how far they come from.
 *
 * Two questions, both answered from coordinates alone (a festival's city, the
 * reader's origin), because distance is the one thing the data always has:
 *
 *   poolReach   the reader is at the focused festival. Which other editions in
 *               the planning period can they also catch? A city a day-trip
 *               away is in, whole. A city further off is in only on the nights
 *               far enough from the focused run to travel between the two — so
 *               an event in Edinburgh during the Jerusalem festival is never
 *               suggested, whatever the data holds.
 *   originReach the reader is coming to a festival. Do they live there, come
 *               from elsewhere in the country, or from abroad? That decides
 *               whether a bed, a train or the airport is worth offering.
 *
 * Crude on purpose: great-circle distance and whole days. A finer model would
 * need timetables this site does not have, and a wrong "you can make it" costs
 * more than a missed suggestion.
 *
 * Pure: no DOM, no fetch.
 */

import { distanceKm } from "../plan/lib/travel.js";

/* Two cities this close are a day-trip apart: a reader staying at one can see
 * a show at the other and sleep in the same bed. Haifa–Acco, Haifa–Jerusalem
 * and Jerusalem–Tel Aviv are all inside it. */
export const DAY_TRIP_KM = 160;

/* Further than this is a day's travel each way that no day-trip covers. */
export const LONG_HAUL_KM = 4500;

/* The reader "lives in the festival's city" within this radius of its centre. */
export const LOCAL_KM = 25;

/* Without a country to compare, a position this close is treated as the same
 * country: close enough to come by train rather than by plane. */
export const DOMESTIC_KM = 400;

/** Whole days of travel between two cities, each way. */
export function travelDays(km) {
  if (km == null) return null;
  if (km <= DAY_TRIP_KM) return 0;
  return km <= LONG_HAUL_KM ? 1 : 2;
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * How each edition in the period stands against the focused one.
 * @param {object} focus the focused edition: `{festivalId, lat, lng, firstDate, lastDate}`
 * @param {object[]} editions every edition overlapping the period, the focused
 *   one included, in the same shape
 * @param {{from: string, to: string}} period the planning period, inclusive
 * @returns {object[]} one entry per edition: `{edition, km, travelDays, verdict,
 *   nights}` — `verdict` is "focus", "day-trip", "partly" (some nights) or
 *   "out"; `nights` is the inclusive ISO date ranges whose performances join
 *   the pool (empty when "out")
 */
export function poolReach(focus, editions, period) {
  return editions.map((edition) => {
    const from = maxIso(period.from, edition.firstDate);
    const to = minIso(period.to, edition.lastDate);
    if (edition.festivalId === focus.festivalId && edition.firstDate === focus.firstDate) {
      return { edition, km: 0, travelDays: 0, verdict: "focus", nights: [{ from, to }] };
    }
    const km = distanceKm(focus, edition);
    const days = travelDays(km);
    if (days === 0) return { edition, km, travelDays: 0, verdict: "day-trip", nights: [{ from, to }] };
    // Unknown distance is not "near": with no coordinates there is no way to
    // say the reader can get there, so the edition waits outside the pool.
    if (days == null) return { edition, km, travelDays: null, verdict: "out", nights: [] };
    // The nights the reader is at the focused festival, plus the travel days
    // either side of it, are nights they cannot also be in the other city.
    const busyFrom = addDays(focus.firstDate, -days);
    const busyTo = addDays(focus.lastDate, days);
    const nights = [];
    if (from < busyFrom) nights.push({ from, to: minIso(to, addDays(busyFrom, -1)) });
    if (to > busyTo) nights.push({ from: maxIso(from, addDays(busyTo, 1)), to });
    const open = nights.filter((r) => r.from <= r.to);
    const verdict = open.length ? "partly" : "out";
    return { edition, km, travelDays: days, verdict, nights: open };
  });
}

/** Whether a performance on `dateISO` is inside one of an entry's night ranges. */
export function inReach(entry, dateISO) {
  return entry.nights.some((r) => r.from <= dateISO && dateISO <= r.to);
}

/**
 * Where a reader is coming from, relative to one festival.
 * @param {object|null} origin what the reader said: `{kind: "city", country,
 *   lat, lng}` (they live in a festival's city), `{kind: "country", country}`
 *   (elsewhere in that country), `{kind: "abroad", country?}`, or
 *   `{kind: "position", lat, lng}` (the device's own)
 * @param {{country: string, lat: number, lng: number}} festival
 * @returns {"local"|"domestic"|"abroad"|null} null while the reader has not said
 */
export function originReach(origin, festival) {
  if (!origin) return null;
  if (origin.kind === "country") return origin.country === festival.country ? "domestic" : "abroad";
  if (origin.kind === "abroad") return origin.country && origin.country === festival.country ? "domestic" : "abroad";
  if (origin.kind === "city" || origin.kind === "position") {
    const km = distanceKm(origin, festival);
    if (km == null) return null;
    if (km <= LOCAL_KM) return "local";
    if (origin.kind === "city") return origin.country === festival.country ? "domestic" : "abroad";
    return km <= DOMESTIC_KM ? "domestic" : "abroad";
  }
  return null;
}

const minIso = (a, b) => (a < b ? a : b);
const maxIso = (a, b) => (a > b ? a : b);
