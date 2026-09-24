/* The pool the calendar drafts from: every performance, of every festival
 * edition in the planning period, that the reader can reach.
 *
 * Each edition arrives adapted on its own (shared/festival-catalogue.js); this
 * joins them into the one catalogue the engine plans. Ids are only unique
 * inside a festival — two festivals may both have a venue called "main-hall" —
 * so every show, venue and kind is renamed `<festival id>/<its own id>`, and
 * `festivalOf()` reads the festival back off any of them.
 *
 * Pure: no DOM, no fetch.
 */

import { inReach } from "../../shared/feasibility.js";

/** An id made unique across festivals. */
export const poolId = (festivalId, id) => `${festivalId}/${id}`;

/** The festival a pool id belongs to. */
export function festivalOf(id) {
  const cut = String(id).indexOf("/");
  return cut === -1 ? null : id.slice(0, cut);
}

/**
 * @param {{catalogue: object, reach: object}[]} parts each loaded edition's
 *   adapted catalogue, with its entry from `poolReach()`
 * @returns {{shows: object[], venues: Map, categories: {slug, name, festivalId}[]}}
 */
export function buildPool(parts) {
  const shows = [];
  const venues = new Map();
  const categories = [];
  for (const { catalogue, reach } of parts) {
    if (reach.verdict === "out") continue;
    const fid = catalogue.festival.id;
    const id = (local) => (local == null ? local : poolId(fid, local));
    const used = new Set();
    for (const show of catalogue.shows) {
      const performances = show.performances
        .filter((p) => inReach(reach, p.date))
        .map((p) => ({ ...p, venue: id(p.venue) }));
      if (!performances.length) continue;
      for (const kind of show.genreSlugs || []) used.add(kind);
      shows.push({
        ...show,
        festivalId: fid,
        slug: id(show.slug),
        genreSlug: id(show.genreSlug),
        genreSlugs: (show.genreSlugs || []).map(id),
        venue: id(show.venue),
        performances,
      });
    }
    for (const [code, venue] of catalogue.venues) venues.set(id(code), { ...venue, code: id(code) });
    for (const c of catalogue.categories) {
      if (used.has(c.slug)) categories.push({ slug: id(c.slug), name: c.name, festivalId: fid });
    }
  }
  return { shows, venues, categories };
}

/** Every day from `from` to `to`, inclusive — the calendar's columns. */
export function daysOf(from, to) {
  const days = [];
  const d = new Date(`${from}T12:00:00Z`);
  while (d.toISOString().slice(0, 10) <= to) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** `iso` moved by `n` days. */
export function shiftDay(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
