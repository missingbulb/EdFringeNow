// Port of the availability semantics in edfringe/extract.py (UNAVAILABLE_STATUSES,
// NON_TICKETED_STATUSES, and the `available` boolean around lines 26-45 & 131-134),
// plus small date/time helpers for the shows.json performance shape.
//
// Field-mapping note (Python model vs. the real shows.json data this runs against):
//   - Python's Performance carries `ticket_status` (from the raw event's
//     `ticketStatus`); shows.json instead uses the field name `status`. Same
//     values, different key — `isAvailable` below reads `perf.status`.
//   - Python's Performance has separate `start`/`end` ISO datetimes (end derived
//     server-side from `estimatedEndDateTime` or `duration`). shows.json only
//     gives `date` + `start` ("HH:MM"), no `end` — see `perfEndMinutes` /
//     `perfEndDate`, which derive it from the show's `duration` (minutes),
//     falling back to end === start when duration is absent, matching the
//     Python fallback of `end = start + timedelta(minutes=dur)` (dur may be None).

// A performance is bookable unless its status is one of these (or it's sold
// out). Denylist ported verbatim from extract.py's UNAVAILABLE_STATUSES so that
// offer statuses like TWO_FOR_ONE / PAY_WHAT_YOU_WANT stay available — they
// still sell tickets.
export const UNAVAILABLE_STATUSES = new Set([
  "SOLD_OUT", "SOLD OUT", "SOLDOUT", "OFF_SALE", "OFFSALE", "NOT_ON_SALE",
  "NOT_YET_ON_SALE", "COMING_SOON", "CANCELLED", "CANCELED", "UNAVAILABLE",
  "POSTPONED", "SUSPENDED",
  // No online allocation left — you'd have to contact the venue, so it can't
  // be added to the edfringe basket. Treated as unavailable for scheduling.
  "NO_ALLOCATION_CONTACT_VENUE",
]);

// Statuses where the show is attended for free with no ticket to buy.
// Attendable (so available), but the purchase step has nothing to add to the
// basket.
export const NON_TICKETED_STATUSES = new Set(["FREE_NON_TICKETED"]);

/**
 * True if a performance is bookable/attendable: not sold out, has a status,
 * and that status (uppercased) isn't in the unavailable denylist.
 * Mirrors extract.py:
 *   available = (not sold_out) and bool(status_norm) and status_norm not in UNAVAILABLE_STATUSES
 *
 * @param {{soldOut?: boolean, status?: string|null}} perf
 * @returns {boolean}
 */
export function isAvailable(perf) {
  if (!perf) return false;
  if (perf.soldOut) return false;
  const statusNorm = (perf.status || "").trim().toUpperCase();
  if (!statusNorm) return false;
  return !UNAVAILABLE_STATUSES.has(statusNorm);
}

/**
 * True if a performance's status marks it as free/non-ticketed (attendable,
 * but nothing to add to a basket).
 * @param {{status?: string|null}} perf
 * @returns {boolean}
 */
export function isNonTicketed(perf) {
  const statusNorm = ((perf && perf.status) || "").trim().toUpperCase();
  return NON_TICKETED_STATUSES.has(statusNorm);
}

// --- date/time helpers --------------------------------------------------

/**
 * Parse a "YYYY-MM-DD" + "HH:MM" pair into minutes since the Unix epoch
 * (UTC-based minute count — treats the wall-clock values as-is, with no
 * timezone conversion, since shows.json stores local Edinburgh wall-clock
 * times and every performance/filter in this app uses the same convention).
 * @param {string} date "YYYY-MM-DD"
 * @param {string} time "HH:MM"
 * @returns {number} minutes since epoch
 */
export function dateTimeToMinutes(date, time) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  // Date.UTC avoids local-timezone-of-the-running-machine drift; this is a
  // pure wall-clock minute count, not a real UTC instant.
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

/**
 * Parse a "YYYY-MM-DD" + "HH:MM" pair into a JS Date (UTC-based, wall-clock
 * semantics — see dateTimeToMinutes).
 * @param {string} date "YYYY-MM-DD"
 * @param {string} time "HH:MM"
 * @returns {Date}
 */
export function dateTimeToDate(date, time) {
  return new Date(dateTimeToMinutes(date, time) * 60000);
}

/**
 * Minutes-since-midnight for an "HH:MM" string (for time-of-day window
 * comparisons independent of date).
 * @param {string} time "HH:MM"
 * @returns {number}
 */
export function timeToMinutesOfDay(time) {
  const [h, mi] = time.split(":").map(Number);
  return h * 60 + mi;
}

/**
 * Compute a performance's end time as minutes-since-epoch, given the show's
 * duration in minutes. shows.json has no explicit `end` field (unlike the
 * Python model) — this derives it as start + duration, matching the Python
 * fallback path where `end` is unset and gets computed from `duration`. When
 * durationMins is null/undefined/0, end === start (matches the Python
 * behaviour when both estimatedEndDateTime and duration are absent).
 * @param {{date: string, start: string}} perf
 * @param {number|null|undefined} durationMins
 * @returns {number} minutes since epoch
 */
export function perfEndMinutes(perf, durationMins) {
  const startMin = dateTimeToMinutes(perf.date, perf.start);
  return durationMins ? startMin + durationMins : startMin;
}

/**
 * Same as perfEndMinutes, but returns a Date.
 * @param {{date: string, start: string}} perf
 * @param {number|null|undefined} durationMins
 * @returns {Date}
 */
export function perfEndDate(perf, durationMins) {
  return new Date(perfEndMinutes(perf, durationMins) * 60000);
}
