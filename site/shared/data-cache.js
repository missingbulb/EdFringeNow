/* A manifest-driven cache for the JSON data files both pages download.
 *
 * The host serves every asset with `Cache-Control: public, max-age=0,
 * must-revalidate` and an ETag, so a browser re-checks every file on every load
 * and only saves the download itself. That is a round trip per data file, and
 * the catalogue is the bulkiest blocking one, so a freshness policy lives here,
 * on the client, where a file that hasn't changed costs no request at all —
 * which no response header can offer.
 *
 * The policy is one published manifest (data/manifest.json, written by
 * scraper/normalize.py's build_manifest — see its module docstring) naming
 * every data file's current sha256. It is fetched uncached, in full, on every
 * load — a stale copy of the manifest would carry a valid hash of itself, so
 * nothing can attest to its own freshness, and caching it would just move the
 * staleness up one level and hide it. Everything else is then a string
 * compare: a cached file's URL is stamped with the manifest hash it was
 * fetched under, and the next load re-fetches only the URLs whose current
 * manifest hash has moved. No TTL is guessed for any file, and no downloaded
 * payload is ever re-hashed to check it — the manifest is the one place that
 * fact is computed, and the client just remembers what it was told.
 *
 * When the manifest itself can't be fetched, freshness is unknowable rather
 * than assumed: every cachedFetchJson call for that load goes straight to the
 * network instead of trusting whatever is in Cache Storage. The data still
 * loads correctly either way — this only forgoes the reuse, never the
 * correctness of what's rendered.
 *
 * Payloads go into the Cache Storage API rather than localStorage, whose ~5 MB
 * ceiling the catalogue alone would breach. Cache Storage has no expiry of its
 * own, so the manifest hash each entry was fetched under is kept beside it as a
 * small localStorage map of url -> hash.
 *
 * Pure of any page: both index.html (js/app.js) and the planner (plan/plan.js)
 * resolve their relative data urls against the same origin, so they share one
 * cache and one stamp map, and a file fetched by either is reused by the other.
 */

const CACHE_NAME = "edfringe-data-v1";
const STAMPS_KEY = "edfringe.data.fetched.v1"; // url -> manifest hash at the last successful cache write

export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

/**
 * Fetch data/manifest.json, uncached — see the module doc for why it must
 * never be. A failure here degrades every cachedFetchJson call for this load
 * to "freshness unknown" (always ask the network); it is never itself the
 * caller's error, since the data files load normally regardless.
 *
 * @param {string} url
 * @param {(err: unknown, url: string) => void} [onNote] optional log sink
 * @returns {Promise<{v: number, files: Record<string,string>}|null>}
 */
export async function fetchManifest(url, onNote) {
  try {
    return await fetchJson(url);
  } catch (err) {
    (onNote || (() => {}))(err, url);
    return null;
  }
}

/**
 * The manifest's key for a fetch url: the path segment from "data/" on.
 *
 * The two pages spell the same file differently — js/app.js fetches
 * "data/venues.json", plan/plan.js fetches "../data/venues.json" — because
 * each is relative to where the page itself lives, while the manifest (and
 * scraper/normalize.py's build_manifest) knows nothing about either page and
 * names files relative to site/data/ alone. This resolves the climbing by
 * hand rather than via the URL API, so it needs no DOM and is unit-testable
 * under plain Node.
 *
 * @param {string} url
 * @returns {string|null} null for a url with no "data" segment
 */
export function dataRelativeKey(url) {
  const stack = [];
  for (const seg of url.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  const i = stack.indexOf("data");
  return i === -1 ? null : stack.slice(i + 1).join("/");
}

/* The manifest hash each cached URL was fetched under. A plain localStorage
 * map — the payloads live in Cache Storage, this is only the bookkeeping
 * beside them. */
function fetchStamps() {
  try {
    const raw = JSON.parse(localStorage.getItem(STAMPS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function stampFetch(url, hash) {
  try {
    localStorage.setItem(STAMPS_KEY, JSON.stringify({ ...fetchStamps(), [url]: hash }));
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
 * The stamp matters as much as the payload: one left behind keeps claiming a
 * hash we've already rejected as unreadable, so the next load — and the next,
 * until the manifest hash for this url happens to change again — makes the
 * same bad decision.
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
 * fetchJson with a local copy kept for as long as the manifest says it's still
 * current.
 *
 * `manifest` is what fetchManifest(MANIFEST_URL) returned for this load — null
 * when it couldn't be fetched, or an object whose `files` map is missing this
 * url's key for a file the published manifest doesn't (yet) name. Either way
 * this treats the file's freshness as unknown and always asks the network,
 * which is the safe default: never claim a cached copy is current without the
 * manifest's word for it. When the manifest does name a hash for this url, the
 * cached copy is used exactly when its stamp matches — nothing is re-hashed to
 * double-check.
 *
 * If the network request fails and a stale copy exists, the stale copy wins
 * regardless of its stamp: a week-old description or yesterday's catalogue is
 * far better than an error page, and the caller has no way to draw anything
 * without one.
 *
 * Degrades to a plain fetch wherever Cache Storage isn't available (it needs a
 * secure context, so `file://` and plain http get the uncached path).
 *
 * @param {string} url
 * @param {{files: Record<string,string>}|null} manifest fetchManifest's result
 * @param {(err: unknown, url: string) => void} [onNote] optional log sink
 */
export async function cachedFetchJson(url, manifest, onNote, validate) {
  const note = onNote || (() => {});
  const check = (data) => {
    if (validate && !validate(data)) throw new Error(`${url} failed validation`);
    return data;
  };
  const wantHash = manifest && manifest.files ? manifest.files[dataRelativeKey(url)] : undefined;

  let cache = null;
  try {
    if (typeof caches !== "undefined") cache = await caches.open(CACHE_NAME);
  } catch {
    cache = null;
  }
  if (!cache) return check(await fetchJson(url));

  if (typeof wantHash === "string" && fetchStamps()[url] === wantHash) {
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
      // Stamp with the hash the manifest asserted, never one we computed —
      // that is the whole "record the hash, don't re-hash" design. With no
      // known hash for this url, leave it unstamped so the next load treats
      // it as unknown again rather than trusting a copy of unknown vintage.
      if (typeof wantHash === "string") stampFetch(url, wantHash);
      else unstampFetch(url);
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
