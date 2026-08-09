/* A TTL cache for the JSON data files both pages download.
 *
 * The site ships no server it controls: GitHub Pages sets its own
 * `Cache-Control` and there is no way to vary it per file. So the freshness
 * policy lives here, on the client, where each file can be given the lifetime
 * its *content* actually has:
 *
 *   - the catalogue the planner searches turns over rarely and is the bulkiest
 *     blocking download, so it is held for days;
 *   - ticket availability moves hourly and is held for a day;
 *   - descriptions are effectively immutable and are held for a week.
 *
 * Payloads go into the Cache Storage API rather than localStorage, whose ~5 MB
 * ceiling the catalogue alone would breach. Cache Storage has no expiry of its
 * own, so the clock is kept beside it as a small localStorage map of
 * url -> epoch ms of the last fetch.
 *
 * Pure of any page: both index.html (js/app.js) and the planner (plan/plan.js)
 * resolve their relative data urls against the same origin, so they share one
 * cache and one stamp map, and a file fetched by either is reused by the other.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const CACHE_NAME = "edfringe-data-v1";
const STAMPS_KEY = "edfringe.data.fetched.v1"; // url -> epoch ms of the last fetch

export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

/* When each cached URL was last fetched. A plain localStorage map — the
 * payloads live in Cache Storage, this is only the clock beside them. */
function fetchStamps() {
  try {
    const raw = JSON.parse(localStorage.getItem(STAMPS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function stampFetch(url) {
  try {
    localStorage.setItem(STAMPS_KEY, JSON.stringify({ ...fetchStamps(), [url]: Date.now() }));
  } catch {
    /* private mode / full quota — we just re-fetch next time */
  }
}

/**
 * fetchJson with a local copy kept for `ttlMs`.
 *
 * Inside the TTL the cached body is returned without touching the network.
 * Outside it — or with nothing cached — the network is asked, and the answer
 * replaces the copy. If that request fails and a stale copy exists, the stale
 * copy wins: a week-old description or yesterday's catalogue is far better than
 * an error page, and the caller has no way to draw anything without one.
 *
 * Degrades to a plain fetch wherever Cache Storage isn't available (it needs a
 * secure context, so `file://` and plain http get the uncached path).
 *
 * @param {string} url
 * @param {number} ttlMs how long a downloaded copy may be reused
 * @param {(err: unknown, url: string) => void} [onNote] optional log sink
 */
export async function cachedFetchJson(url, ttlMs, onNote) {
  const note = onNote || (() => {});
  let cache = null;
  try {
    if (typeof caches !== "undefined") cache = await caches.open(CACHE_NAME);
  } catch {
    cache = null;
  }
  if (!cache) return fetchJson(url);

  const fetchedAt = fetchStamps()[url];
  if (fetchedAt && Date.now() - fetchedAt < ttlMs) {
    const hit = await cache.match(url);
    if (hit) return hit.json();
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    // Read the payload BEFORE touching Cache Storage, and hand the cache a fresh
    // Response built from the text rather than a clone of this one. Cache.put()
    // consumes the body it is given, and clone() tees a single stream into two —
    // so a put that dies partway (quota, an evicted cache, a dropped connection)
    // errors the response we still have to read. Writing first therefore let a
    // failed *cache write* discard a *successful download*: that is how the
    // planner lost availability.min.json and drew every show as unavailable
    // (#309). The cache is an optimisation; the payload is the point.
    const text = await res.text();
    const data = JSON.parse(text);
    try {
      await cache.put(url, new Response(text, { headers: { "Content-Type": "application/json" } }));
      stampFetch(url);
    } catch (err) {
      note(err, url);
    }
    return data;
  } catch (err) {
    const stale = await cache.match(url);
    if (stale) {
      note(err, url);
      return stale.json();
    }
    throw err;
  }
}
