/* The time wheel's arithmetic — what the "next commitment" picker is allowed to
 * offer, and where it opens. Pure functions of "minutes since the start of the
 * fringe day", so they're testable without a DOM (see
 * js/__tests__/constraint-time.test.mjs).
 *
 * The rule the whole file serves: the wheel offers everything from now to the
 * end of the day and nothing before it. A picker that opens on a time you've
 * already missed — or one that skips the next hour because no show happens to
 * start in it — reads as broken.
 *
 * "The end of the day" is the FRINGE day (shared/fringe-day.js), which runs to
 * 06:00 the next morning. So late in the evening the hour wheel rolls on past 23
 * into the extended hours 24–29, and the times it produces ("24:30") are the
 * same extended strings the day file and the rest of the app use. The wheel
 * *labels* them 00–05 (js/app.js) — the extension is bookkeeping, not something
 * anyone should have to read.
 */

import { DAY_MINUTES, FRINGE_DAY_END_MINUTES } from "../shared/fringe-day.js";

export const WHEEL_STEP = 5; // the wheel's minute granularity
export const WHEEL_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/* The last five-minute slot of the fringe day — 29:55, i.e. 05:55 tomorrow. */
const LAST_SLOT = FRINGE_DAY_END_MINUTES - WHEEL_STEP;
const LAST_HOUR = Math.floor(LAST_SLOT / 60);

/* How far ahead the picker *opens*. Far enough that there's a real choice of
 * shows to aim for, near enough to still be part of the same outing. */
export const CONSTRAINT_DEFAULT_LEAD_MINUTES = 120;

/* The earliest slot the wheel offers: the next whole five minutes from now,
 * never past the last slot of the day (so a late-night now still has a wheel). */
export function earliestWheelMinutes(nowMinutes) {
  return Math.min(Math.ceil(nowMinutes / WHEEL_STEP) * WHEEL_STEP, LAST_SLOT);
}

/* The hours the wheel offers: the current hour through the end of the fringe
 * day, zero-padded. Past midnight these are the extended hours 24–29. */
export function wheelHours(nowMinutes) {
  const h0 = Math.floor(earliestWheelMinutes(nowMinutes) / 60);
  const hours = [];
  for (let h = h0; h <= LAST_HOUR; h++) hours.push(String(h).padStart(2, "0"));
  return hours;
}

/* Minutes offered for a given hour. Every hour gets the full set except the
 * current one, where the minutes already gone are dropped. */
export function minutesForHour(hh, nowMinutes) {
  const earliest = earliestWheelMinutes(nowMinutes);
  if (parseInt(hh, 10) !== Math.floor(earliest / 60)) return WHEEL_MINUTES;
  const floor = earliest % 60;
  return WHEEL_MINUTES.filter((m) => +m >= floor);
}

/* Where the wheel opens when nothing is chosen yet: now + the default lead,
 * snapped to the five-minute grid and kept inside the fringe day. */
export function defaultConstraintTime(nowMinutes) {
  const target =
    Math.round((nowMinutes + CONSTRAINT_DEFAULT_LEAD_MINUTES) / WHEEL_STEP) * WHEEL_STEP;
  const mins = Math.max(earliestWheelMinutes(nowMinutes), Math.min(target, LAST_SLOT));
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/* Re-exported so callers that only talk to the wheel don't have to reach past it
 * for the one constant they need. */
export { DAY_MINUTES, FRINGE_DAY_END_MINUTES };
