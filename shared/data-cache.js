/* A TTL cache for the JSON data files both pages download.
 *
 * The site ships no server it controls: GitHub Pages sets its own
 * `Cache-Control` and there is no way to vary it per file. So the freshness
 * policy lives here, on the client, where each file can be given the lifetime
 * its *content* actually has:
 *
 *   - the catalogue the planner searches turns over rarely and is the bulkiest
 *     blocking download, so it is held for days;
 *   - ticket availability changes through the festival and is held for a day;
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

function unstampFetch(url) {
  try {
    const stamps = fetchStamps();
    delete stamps[url];
    localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps));
  } catch {
    /* as above — the worst case is one extra fetch */
  }
}

/**
 * Throw away a cached copy we've judged unusable, clock and all.
 *
 * The clock matters as much as the payload: a stamp left behind keeps pointing
 * at an entry we've already rejected, so the next load makes the same bad
 * decision, and the next — for a day on availability, four days on the
 * catalogue.
 */
async function dropCached(cache, url, note) {
  try {
    await cache.delete(url);
  } catch (err) {
    note(err, url);
  }
  unstampFetch(url);
}

/**
 * Throw away a cached copy from outside this module, for the caller that can see
 * something this module can't: that two separately-cached files, each valid on
 * its own, no longer describe the same thing. Evicting both and refetching is
 * how that gets repaired without making the visitor clear their storage.
 *
 * A no-op wherever Cache Storage isn't available, since there is nothing to
 * evict and the next read goes to the network anyway.
 *
 * @param {string} url
 */
export async function evictCached(url) {
  let cache = null;
  try {
    if (typeof caches !== "undefined") cache = await caches.open(CACHE_NAME);
  } catch {
    cache = null;
  }
  if (!cache) return;
  await dropCached(cache, url, () => {});
}

/**
 * A cached copy we can actually use, or null.
 *
 * Every failure here is a miss, never a throw. A cached copy is an optimisation,
 * and the one thing it must never do is stand between the caller and the
 * network — but that is exactly what it did in #309: `cache.match(url)` and
 * `hit.json()` both ran unguarded with no fall-through, so an entry that read
 * back as an error propagated straight out of cachedFetchJson. The network was
 * never asked. With the stamp still fresh it failed the same way on every load
 * until the TTL expired.
 *
 * `validate` covers the quieter version of the same problem: a stored copy from
 * an older generation of the file, which parses cleanly and then joins to
 * nothing downstream. This module can't know one file's schema from another's,
 * so the caller that does gets to reject it.
 *
 * @returns {Promise<{data: unknown}|null>} boxed so a validly-null payload is
 *   distinguishable from a miss
 */
async function readCached(cache, url, validate, note) {
  let hit;
  try {
    hit = await cache.match(url);
  } catch (err) {
    note(err, url);
    return null;
  }
  if (!hit) return null;

  let data;
  try {
    data = await hit.json();
  } catch (err) {
    note(err, url);
    await dropCached(cache, url, note);
    return null;
  }

  if (validate && !validate(data)) {
    note(new Error(`cached copy of ${url} failed validation`), url);
    await dropCached(cache, url, note);
    return null;
  }
  return { data };
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
export async function cachedFetchJson(url, ttlMs, onNote, validate) {
  const note = onNote || (() => {});
  const check = (data) => {
    if (validate && !validate(data)) throw new Error(`${url} failed validation`);
    return data;
  };
  let cache = null;
  try {
    if (typeof caches !== "undefined") cache = await caches.open(CACHE_NAME);
  } catch {
    cache = null;
  }
  if (!cache) return check(await fetchJson(url));

  const fetchedAt = fetchStamps()[url];
  if (fetchedAt && Date.now() - fetchedAt < ttlMs) {
    const hit = await readCached(cache, url, validate, note);
    if (hit) return hit.data;
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
    const data = check(JSON.parse(text));
    try {
      await cache.put(url, new Response(text, { headers: { "Content-Type": "application/json" } }));
      stampFetch(url);
    } catch (err) {
      note(err, url);
    }
    return data;
  } catch (err) {
    // Same read as above, and the same rule: a stale copy that can't be read (or
    // that validation rejects) is no copy at all. It must not become the error
    // the caller sees — that would report a cache problem for what is really a
    // network one, and send them chasing the wrong thing.
    const stale = await readCached(cache, url, validate, note);
    if (stale) {
      note(err, url);
      return stale.data;
    }
    throw err;
  }
}
