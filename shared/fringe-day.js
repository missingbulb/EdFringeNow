/* The Fringe day — where one festival day ends and the next begins.
 *
 * A calendar day is the wrong unit for a festival whose latest shows start at
 * midnight and after. At 23:50 the only question worth answering is "what can I
 * still get into tonight", and the honest answer includes the 00:30 show. A
 * midnight cut empties the page at exactly the moment someone is looking for a
 * later show, and hands them tomorrow's breakfast listings instead.
 *
 * So everything here works in FRINGE days: the day named "2026-08-14" runs from
 * 06:00 on the 14th to 06:00 on the 15th. 06:00 is the seam because it is the
 * quiet hour — the catalogue has nothing at all between 00:30 and 06:00 — so
 * the join falls where nobody is looking, and a show never lands on a day its
 * audience wouldn't call it.
 *
 * A time inside a fringe day is counted in minutes from that day's OWN midnight,
 * so the range is 360 (06:00) through 1799 (05:59 the next morning) and anything
 * past midnight is >= 1440. The "HH:MM" strings the page passes around carry the
 * same extension: 00:30 the next morning is "24:30", which keeps every string
 * comparison, sort and lookup key in the app correctly ordered. Only the display
 * layer wraps it back to "00:30" (clockHHMM / hourLabel).
 *
 * ONE boundary, defined once. The scraper buckets performances into day files by
 * it (scraper/normalize.py), the Now page picks its day file and its "now" by it
 * (js/app.js), the time wheel stops at it (js/constraint-time.js) and the
 * planner folds its late shows by it (plan/lib/engine.js). A second cut-off
 * anywhere would show up as shows that exist on one screen and not the other,
 * so new code reads the boundary from here rather than restating it — and a
 * test (shared/__tests__/fringe-day.test.mjs) holds the Python copy to the same
 * number.
 */

/** Minutes in a calendar day. */
export const DAY_MINUTES = 1440;

/** The seam: the clock time at which one fringe day becomes the next (06:00). */
export const FRINGE_DAY_START_MINUTES = 6 * 60;

/** One past the last minute of a fringe day, in that day's own minutes: 06:00
 * the following morning (30:00 = 1800). Half-open, so a 06:00 show belongs to
 * the morning it happens in, not the night before — "7am Oboe Rave" is a
 * breakfast show, not a late one. */
export const FRINGE_DAY_END_MINUTES = FRINGE_DAY_START_MINUTES + DAY_MINUTES;

/** "HH:MM" -> minutes. Accepts the extended hours (24–29) this module uses. */
export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

/** Minutes -> extended "HH:MM": 1470 -> "24:30". The form the app stores. */
export function minutesToTime(minutes) {
  const r = Math.round(minutes);
  return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
}

/** Minutes -> the "HH:MM" a person reads: 1470 -> "00:30". Display only. */
export function clockHHMM(minutes) {
  const r = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
}

/** An extended "HH:MM" as it should be shown: "24:30" -> "00:30". */
export function clockLabel(hhmm) {
  return hhmm ? clockHHMM(timeToMinutes(hhmm)) : hhmm;
}

/** An extended hour ("24".."29") as it should be shown: "25" -> "01". */
export function hourLabel(hh) {
  return String(Number(hh) % 24).padStart(2, "0");
}

/** True once a fringe-day time has crossed into the next calendar day. */
export function isAfterMidnight(minutes) {
  return minutes >= DAY_MINUTES;
}

/** A "YYYY-MM-DD" shifted by whole days. UTC arithmetic so it can't be moved by
 * the host's zone or by a DST hop. */
export function shiftDate(dateISO, days) {
  const [y, m, d] = String(dateISO).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const p2 = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}`;
}

/**
 * Which fringe day a real calendar moment belongs to.
 *
 * Before 06:00 you are still in the night before: the date moves back one and
 * the minutes move forward past 24:00, so 01:15 on the 15th is the 14th at 1515.
 *
 * Takes a date and a minute rather than a Date on purpose: which day a moment
 * falls in depends on the zone you read it in, and the answer this site wants is
 * always Edinburgh's. Callers pass what festivalNow (js/clock.js) read for them,
 * so there is no second, device-zone way to ask the same question.
 *
 * @param {string} dateISO real calendar date, "YYYY-MM-DD"
 * @param {number} minutesOfDay real minutes since that date's midnight (0–1439)
 * @returns {{date: string, minutes: number}} fringe date + minutes within it
 */
export function fringeMoment(dateISO, minutesOfDay) {
  if (minutesOfDay < FRINGE_DAY_START_MINUTES) {
    return { date: shiftDate(dateISO, -1), minutes: minutesOfDay + DAY_MINUTES };
  }
  return { date: dateISO, minutes: minutesOfDay };
}

/**
 * The real calendar moment behind a fringe-day time — the inverse of
 * fringeMoment. Anything a third party has to understand (a booking link's
 * date, a calendar entry) needs the real date, not the fringe one.
 *
 * @param {string} fringeDate "YYYY-MM-DD" of the fringe day
 * @param {number|string} time minutes within it, or an extended "HH:MM"
 * @returns {{date: string, time: string}} real date + real "HH:MM"
 */
export function realMoment(fringeDate, time) {
  const minutes = typeof time === "number" ? time : timeToMinutes(time);
  const days = Math.floor(minutes / DAY_MINUTES);
  return { date: shiftDate(fringeDate, days), time: clockHHMM(minutes) };
}
