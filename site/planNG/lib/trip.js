/* The reader's trip: the first and last day the page plans, as rules.
 *
 * The trip is the reader's own, set on the timeline; a festival is only a
 * shortcut to its run. Which festival leads a trip — whose theme the page
 * wears and whose city reach is judged from — is the one the reader chose
 * while the trip still reaches it, and otherwise follows from the dates.
 *
 * Pure: no DOM, no storage.
 */

import { daysOf, shiftDay } from "./pool.js";
import { editionKey } from "./timeline.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A festival edition's run and a day either side, for getting there and back. */
export function tripForEdition(edition) {
  return { from: shiftDay(edition.firstDate, -1), to: shiftDay(edition.lastDate, 1) };
}

/**
 * A trip made whole: ends in order, no longer than `maxDays`, inside `span`.
 * @param {{from: string, to: string}} trip
 * @param {object} o
 * @param {"from"|"to"|null} o.moved the end the reader just set, which holds
 *   while the other one gives way; null holds the first day
 * @param {number} o.maxDays
 * @param {{from: string, to: string}} [o.span] the days the timeline shows
 */
export function normalizeTrip({ from, to }, { moved = null, maxDays, span = null }) {
  if (from > to) [from, to] = [to, from];
  if (span) {
    from = from < span.from ? span.from : from > span.to ? span.to : from;
    to = to < span.from ? span.from : to > span.to ? span.to : to;
  }
  if (daysOf(from, to).length > maxDays) {
    if (moved === "to") from = shiftDay(to, -(maxDays - 1));
    else to = shiftDay(from, maxDays - 1);
  }
  return { from, to };
}

/** The trip a query string names, or null: `?from=&to=`. */
export function tripFromQuery(params) {
  const from = params.get("from");
  const to = params.get("to");
  return from && to && ISO.test(from) && ISO.test(to) ? { from, to } : null;
}

/**
 * The edition that leads a trip: the one the reader chose (`pick`, an edition
 * key) while the trip overlaps its run; otherwise the one the trip covers most
 * days of, the earlier start breaking a tie; with none inside it, the nearest
 * by date.
 * @param {{festivals: object[]}} registry
 * @param {{from: string, to: string, pick?: string|null}} trip
 * @returns {{festival: object, edition: object}|null}
 */
export function leadEdition(registry, { from, to, pick = null }) {
  let best = null;
  for (const festival of registry.festivals) {
    for (const edition of festival.editions) {
      const lo = edition.firstDate > from ? edition.firstDate : from;
      const hi = edition.lastDate < to ? edition.lastDate : to;
      const overlap = lo <= hi ? daysOf(lo, hi).length : 0;
      if (overlap && pick === editionKey(festival.id, edition.id)) return { festival, edition };
      // How far off an edition that misses the trip is, in days; 0 if it overlaps.
      const gap = overlap
        ? 0
        : edition.lastDate < from
          ? daysOf(edition.lastDate, from).length - 1
          : daysOf(to, edition.firstDate).length - 1;
      const score = { festival, edition, overlap, gap };
      if (
        !best ||
        score.overlap > best.overlap ||
        (score.overlap === best.overlap && score.gap < best.gap) ||
        (score.overlap === best.overlap && score.gap === best.gap && edition.firstDate < best.edition.firstDate)
      ) {
        best = score;
      }
    }
  }
  return best ? { festival: best.festival, edition: best.edition } : null;
}
