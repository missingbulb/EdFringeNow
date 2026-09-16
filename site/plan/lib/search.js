// Catalogue search for the planner's add-one-by-one flow: plain-text matching
// plus facet filters (genre, subgenre, accessibility, age limit, price) over
// the rehydrated show records.
//
// Pure — no DOM, no fetch. plan.js feeds it the catalogue from buildIndex and
// renders the results; the unit tests live in __tests__/search.test.mjs.
//
// Two facets read fields that may simply be absent for a show:
//   - `show.accessibility` — an array of enum strings (the API's per-show
//     `accessibility` list). Not shipped by the scraper yet.
//   - `show.priceMin` — the cheapest band in pounds, from the price cache
//     (scraper/fetch_prices.py). Present for free shows and for anything the
//     price pass has reached; null otherwise, and null is *not* £0.
// Absence means unknown, and an active filter on these facets excludes
// unknowns — a filter must never claim a show matches on data it doesn't
// have. catalogueFacets() tells the UI whether either facet has any data at
// all, so it can disable the control instead of offering a filter that
// silently matches nothing.

// Age-restriction enum → the minimum age it admits. Keys are the full
// ageRestrictions value set in data/venues.json.
export const AGE_LIMIT_YEARS = {
  ZERO: 0,
  THREE: 3,
  FIVE: 5,
  EIGHT: 8,
  TWELVE: 12,
  FOURTEEN: 14,
  SIXTEEN: 16,
  EIGHTEEN: 18,
};

/** Minimum admitted age for a show, or null when unknown. */
export function ageLimitYears(show) {
  const v = AGE_LIMIT_YEARS[show && show.ageRestriction];
  return v === undefined ? null : v;
}

// The price vocabulary is shared with the Now page rather than defined twice —
// two pages disagreeing about what a show costs is worse than either being
// wrong. Re-exported so this module stays the planner's one search import.
import { showPrice } from "../../shared/price.js";

export { showPrice };

/** The show's declared accessibility options ([] when none / unknown). */
export function showAccessibility(show) {
  const list = show && show.accessibility;
  return Array.isArray(list) ? list : [];
}

/**
 * One pass over the catalogue: which optional facets carry any data, and the
 * value set for the data-driven ones.
 *
 * @returns {{accessibility: string[], hasPrice: boolean}} accessibility is the
 *   sorted union of declared options (empty = the facet has no data yet).
 */
export function catalogueFacets(shows) {
  const access = new Set();
  let hasPrice = false;
  for (const show of shows || []) {
    for (const a of showAccessibility(show)) access.add(a);
    // A *paid* show with a known amount is what makes the "up to £X" caps
    // worth offering. Free shows alone don't: every cap would return exactly
    // the free list, which the Free option already gives.
    if (!hasPrice && showPrice(show) > 0) hasPrice = true;
  }
  return { accessibility: [...access].sort(), hasPrice };
}

/**
 * @typedef {object} SearchFilters
 * @property {string|string[]} [genre]         genre label(s); several = any of them
 * @property {string|string[]} [subgenre]      subgenre label(s) (matched in show.subgenres)
 * @property {string|string[]} [accessibility] enum value(s) the show must declare
 * @property {string|string[]} [venue]         venue code(s) — `show.venue`, so every
 *                                    room of a venue counts as that venue
 * @property {number} [maxAge]        highest admitted minimum age (inclusive):
 *                                    2 excludes nothing rated above 2; unknown excluded
 * @property {"free"|number} [price]  "free", or a cap in pounds (inclusive);
 *                                    unknown-price shows excluded either way
 *
 * The four label facets take one value or many. Many are OR'd — the UI offers
 * them as checkbox lists, where ticking a second box widens the search — while
 * separate facets are AND'd.
 */

/** A facet's values as a list: "" / undefined / [] all mean "not set". */
function facetValues(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

/** True when any filter field is set (i.e. filtering would narrow the list). */
export function hasActiveFilters(filters) {
  const f = filters || {};
  return (
    facetValues(f.genre).length > 0 ||
    facetValues(f.subgenre).length > 0 ||
    facetValues(f.accessibility).length > 0 ||
    facetValues(f.venue).length > 0 ||
    typeof f.maxAge === "number" ||
    f.price === "free" ||
    typeof f.price === "number"
  );
}

/** The shows passing every set filter (see SearchFilters for the semantics). */
export function filterShows(shows, filters) {
  const f = filters || {};
  const genres = facetValues(f.genre);
  const subgenres = facetValues(f.subgenre);
  const access = facetValues(f.accessibility);
  const venues = facetValues(f.venue);
  return (shows || []).filter((show) => {
    if (genres.length && !genres.includes(show.genre)) return false;
    if (subgenres.length && !subgenres.some((s) => (show.subgenres || []).includes(s))) return false;
    if (access.length && !access.some((a) => showAccessibility(show).includes(a))) return false;
    if (venues.length && !venues.includes(String(show.venue))) return false;
    if (typeof f.maxAge === "number") {
      const age = ageLimitYears(show);
      if (age === null || age > f.maxAge) return false;
    }
    if (f.price === "free") {
      if (showPrice(show) !== 0) return false;
    } else if (typeof f.price === "number") {
      const price = showPrice(show);
      if (price === null || price > f.price) return false;
    }
    return true;
  });
}

// Case- and accent-insensitive matching: "cafe" finds "Café".
function fold(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Escape a string for use inside a RegExp (word-boundary probes below).
function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** What a show's searchable description text is, when the caller doesn't say.
 *  The one-line blurb travels in the catalogue itself, so description search
 *  works from the first byte; a caller with the fuller descriptions sidecar
 *  loaded passes its own `describe` and the same search simply reaches
 *  further. */
const defaultDescribe = (show) => show.blurb || "";

/**
 * Rank one show against a folded query. 0 = no match. Title matches outrank
 * company/venue matches, which outrank a hit found only in the description;
 * within the title: prefix > word start > anywhere. Multi-word queries must
 * land every word somewhere in the text considered.
 */
function scoreShow(show, foldedQuery, tokens, describe) {
  const title = fold(show.title);
  const rest = fold(`${show.company || ""} ${show.venueName || ""}`);
  const hay = `${title} ${rest}`;

  if (!tokens.every((t) => hay.includes(t))) {
    // Nothing in the name, company or venue — try the description before
    // giving up. A show found only this way ranks below every named match, so
    // description hits extend the tail of the results rather than reordering
    // the head someone was already looking at.
    const desc = fold(describe(show) || "");
    if (!desc) return 0;
    const deep = `${hay} ${desc}`;
    return tokens.every((t) => deep.includes(t)) ? 0.5 : 0;
  }

  if (title.startsWith(foldedQuery)) return 4;
  if (new RegExp(`\\b${reEscape(foldedQuery)}`).test(title)) return 3;
  if (title.includes(foldedQuery)) return 2;
  return 1;
}

/**
 * The main entry: filter, then match the query, then rank.
 *
 * - Empty query + no active filters → nothing (the UI shows no popup).
 * - Empty query + filters → the whole filtered list, A→Z (browse by facet).
 * - With a query: ranked matches (see scoreShow), ties A→Z.
 *
 * @param {object[]} shows        the catalogue (e.g. [...index.values()])
 * @param {string} query          raw user text
 * @param {SearchFilters} filters
 * @param {{limit?: number, describe?: (show: object) => string}} [opts]
 *   `describe` supplies the description text to search for a show; it defaults
 *   to the catalogue's own one-line blurb. The planner passes a function that
 *   prefers the fuller descriptions sidecar once it has downloaded, so the same
 *   query reaches deeper the longer the page has been open.
 * @returns {{results: object[], total: number}} results capped at limit;
 *   total is the uncapped match count (for a "showing X of Y" footer)
 */
export function searchShows(shows, query, filters, { limit = 30, describe = defaultDescribe } = {}) {
  const foldedQuery = fold(query).trim().replace(/\s+/g, " ");
  const tokens = foldedQuery ? foldedQuery.split(" ") : [];
  if (tokens.length === 0 && !hasActiveFilters(filters)) return { results: [], total: 0 };

  const pool = filterShows(shows, filters);
  const byTitle = (a, b) => fold(a.title).localeCompare(fold(b.title));

  if (tokens.length === 0) {
    const all = [...pool].sort(byTitle);
    return { results: all.slice(0, limit), total: all.length };
  }

  const scored = [];
  for (const show of pool) {
    const score = scoreShow(show, foldedQuery, tokens, describe);
    if (score > 0) scored.push({ show, score });
  }
  scored.sort((a, b) => b.score - a.score || byTitle(a.show, b.show));
  return { results: scored.slice(0, limit).map((s) => s.show), total: scored.length };
}

// --- Facet suggestions ("you typed a venue, not a show") -------------------
//
// A query is often the name of a *category* rather than a show: "pleasance",
// "cabaret", "stand-up". Those deserve an answer the show list can't give — set
// the matching filter and see the whole slate — so the UI offers them as rows
// above the show hits, and picking one ticks that facet.

/**
 * The venues that actually have shows, A→Z by name: `{value, label, count}`,
 * where value is the venue code (`show.venue`) and count is its show tally —
 * the tie-break that puts a hub above its satellite in a suggestion list.
 */
export function catalogueVenues(shows, venueMap) {
  const counts = new Map();
  for (const show of shows || []) {
    const code = show && show.venue != null ? String(show.venue) : "";
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const out = [];
  for (const [code, count] of counts) {
    const entry = (venueMap || {})[code];
    const label = (entry && entry.name) || null;
    if (label) out.push({ value: code, label, count });
  }
  out.sort((a, b) => fold(a.label).localeCompare(fold(b.label)));
  return out;
}

// A label match is worth ranking three ways, same idea as scoreShow: the query
// starts the name > starts a word in it > lands anywhere in it.
function scoreLabel(label, foldedQuery) {
  const l = fold(label);
  if (l.startsWith(foldedQuery)) return 3;
  if (new RegExp(`\\b${reEscape(foldedQuery)}`).test(l)) return 2;
  if (l.includes(foldedQuery)) return 1;
  return 0;
}

// Which facet wins a score tie — the broader the category, the higher it sits.
const FACET_ORDER = ["genre", "subgenre", "venue"];

/**
 * The genres, subgenres and venues whose names the query matches, best first.
 *
 * @param {string} query raw user text (under 2 characters yields nothing — a
 *   single letter matches half the programme and would bury the show hits)
 * @param {{genres?: string[], subgenres?: string[],
 *          venues?: {value: string, label: string, count?: number}[]}} catalogue
 *   the value sets to offer; venues carry a code (`value`) distinct from their
 *   display name, and an optional show `count` that breaks score ties (so
 *   "pleasance" offers the Courtyard before a one-room outpost)
 * @param {{limit?: number}} [opts]
 * @returns {{kind: "genre"|"subgenre"|"venue", value: string, label: string}[]}
 */
export function matchFacets(query, catalogue, { limit = 4 } = {}) {
  const foldedQuery = fold(query).trim().replace(/\s+/g, " ");
  if (foldedQuery.length < 2) return [];
  const c = catalogue || {};
  const pools = [
    ["genre", (c.genres || []).map((v) => ({ value: v, label: v }))],
    ["subgenre", (c.subgenres || []).map((v) => ({ value: v, label: v }))],
    ["venue", c.venues || []],
  ];

  const hits = [];
  for (const [kind, values] of pools) {
    for (const { value, label, count } of values) {
      const score = scoreLabel(label, foldedQuery);
      if (score > 0) hits.push({ kind, value, label, score, count: count || 0 });
    }
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      FACET_ORDER.indexOf(a.kind) - FACET_ORDER.indexOf(b.kind) ||
      b.count - a.count ||
      fold(a.label).localeCompare(fold(b.label))
  );
  return hits.slice(0, limit).map(({ kind, value, label }) => ({ kind, value, label }));
}
