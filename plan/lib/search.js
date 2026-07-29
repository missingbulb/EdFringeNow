// Catalogue search for the planner's add-one-by-one flow: plain-text matching
// plus facet filters (genre, subgenre, accessibility, age limit, price) over
// the rehydrated show records.
//
// Pure — no DOM, no fetch. plan.js feeds it the catalogue from buildIndex and
// renders the results; the unit tests live in __tests__/search.test.mjs.
//
// Two facets read fields the scraper doesn't ship yet (see scraper/SCRAPING.md
// for both upstream sources):
//   - `show.accessibility` — an array of enum strings (the API's per-show
//     `accessibility` list).
//   - `show.price` — pounds, as a number or a "£12" / "£12.50" string
//     (per-show pricing comes from the per-performance `performancePrices`
//     call and is planned to land as one representative value per show).
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

function parsePrice(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const m = /(\d+(?:\.\d+)?)/.exec(raw);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * The show's price in pounds, or null when unknown. A free show is £0 even
 * with no price field — the `free` flag is reliable today.
 */
export function showPrice(show) {
  if (!show) return null;
  const p = parsePrice(show.price);
  if (p !== null) return p;
  return show.free ? 0 : null;
}

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
    if (!hasPrice && parsePrice(show && show.price) !== null) hasPrice = true;
  }
  return { accessibility: [...access].sort(), hasPrice };
}

/**
 * @typedef {object} SearchFilters
 * @property {string|string[]} [genre]         genre label(s); several = any of them
 * @property {string|string[]} [subgenre]      subgenre label(s) (matched in show.subgenres)
 * @property {string|string[]} [accessibility] enum value(s) the show must declare
 * @property {number} [maxAge]        highest admitted minimum age (inclusive):
 *                                    2 excludes nothing rated above 2; unknown excluded
 * @property {"free"|number} [price]  "free", or a cap in pounds (inclusive);
 *                                    unknown-price shows excluded either way
 *
 * The three label facets take one value or many. Many are OR'd — the UI offers
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
  return (shows || []).filter((show) => {
    if (genres.length && !genres.includes(show.genre)) return false;
    if (subgenres.length && !subgenres.some((s) => (show.subgenres || []).includes(s))) return false;
    if (access.length && !access.some((a) => showAccessibility(show).includes(a))) return false;
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

/**
 * Rank one show against a folded query. 0 = no match. Title matches outrank
 * company/venue matches, and within the title: prefix > word start > anywhere.
 * Multi-word queries must land every word somewhere in title+company+venue.
 */
function scoreShow(show, foldedQuery, tokens) {
  const title = fold(show.title);
  const rest = fold(`${show.company || ""} ${show.venueName || ""}`);
  const hay = `${title} ${rest}`;
  for (const t of tokens) {
    if (!hay.includes(t)) return 0;
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
 * @param {{limit?: number}} [opts]
 * @returns {{results: object[], total: number}} results capped at limit;
 *   total is the uncapped match count (for a "showing X of Y" footer)
 */
export function searchShows(shows, query, filters, { limit = 30 } = {}) {
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
    const score = scoreShow(show, foldedQuery, tokens);
    if (score > 0) scored.push({ show, score });
  }
  scored.sort((a, b) => b.score - a.score || byTitle(a.show, b.show));
  return { results: scored.slice(0, limit).map((s) => s.show), total: scored.length };
}
