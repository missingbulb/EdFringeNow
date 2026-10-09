/* Where a visitor connects from, as a country: the one thing the page cannot
 * know about its reader without asking, and only a guess until they say.
 *
 * Cloudflare's edge already attaches the connecting country to every request
 * (`request.cf.country`); this hands the page that and nothing else of what
 * the edge knows. No other service is asked, and nothing is logged or kept.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };

// A real two-letter country: the edge's own markers for Tor ("T1") and
// unknown ("XX") are no country at all.
const COUNTRY = /^[A-Z]{2}$/;
const NOT_COUNTRIES = new Set(["T1", "XX"]);

/** @returns {Response} `{country: "GB"}`, or `{country: null}` when the edge can't tell. */
export function handleWhere(request) {
  const code = request.cf && request.cf.country;
  const country = typeof code === "string" && COUNTRY.test(code) && !NOT_COUNTRIES.has(code) ? code : null;
  return new Response(JSON.stringify({ country }), { status: 200, headers: JSON_HEADERS });
}
