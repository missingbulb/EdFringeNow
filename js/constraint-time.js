/* The time wheel's arithmetic — what the "next commitment" picker is allowed to
 * offer, and where it opens. Pure functions of "minutes since midnight now", so
 * they're testable without a DOM (see js/__tests__/constraint-time.test.mjs).
 *
 * The rule the whole file serves: the wheel offers everything from now to the
 * end of the day and nothing before it. A picker that opens on a time you've
 * already missed — or one that skips the next hour because no show happens to
 * start in it — reads as broken. */

export const WHEEL_STEP = 5; // the wheel's minute granularity
export const WHEEL_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const LAST_SLOT = 23 * 60 + 55; // the last five-minute slot of the day

/* How far ahead the picker *opens*. Far enough that there's a real choice of
 * shows to aim for, near enough to still be part of the same outing. */
export const CONSTRAINT_DEFAULT_LEAD_MINUTES = 120;

/* The earliest slot the wheel offers: the next whole five minutes from now,
 * never past the last slot of the day (so a late-night now still has a wheel). */
export function earliestWheelMinutes(nowMinutes) {
  return Math.min(Math.ceil(nowMinutes / WHEEL_STEP) * WHEEL_STEP, LAST_SLOT);
}

/* The hours the wheel offers: the current hour through 23, zero-padded. */
export function wheelHours(nowMinutes) {
  const h0 = Math.floor(earliestWheelMinutes(nowMinutes) / 60);
  const hours = [];
  for (let h = h0; h <= 23; h++) hours.push(String(h).padStart(2, "0"));
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
 * snapped to the five-minute grid and kept inside today. */
export function defaultConstraintTime(nowMinutes) {
  const target =
    Math.round((nowMinutes + CONSTRAINT_DEFAULT_LEAD_MINUTES) / WHEEL_STEP) * WHEEL_STEP;
  const mins = Math.max(earliestWheelMinutes(nowMinutes), Math.min(target, LAST_SLOT));
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
