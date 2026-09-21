// Tests for the manifest-driven data cache (shared/data-cache.js).
//
// This is the whole of the site's freshness policy — GitHub Pages won't let us
// set Cache-Control per file, so the decision of whether each data file may be
// reused lives here, keyed off data/manifest.json's per-file hash rather than a
// guessed lifetime. The behaviours worth pinning down are the ones that fail
// quietly in a browser: a hash match that doesn't actually suppress the
// network, a moved hash that doesn't actually re-fetch, a missing manifest
// that gets treated as "nothing changed" instead of "unknown", and the
// fallbacks (no Cache Storage, a dead network, a full quota) that must still
// hand the caller its data.
//
// Cache Storage and localStorage don't exist in Node, so both are stubbed. The
// stubs are deliberately thin: `caches.open` returning a `{match, put}` pair is
// the entire surface the module uses.

import { test } from "node:test";
import assert from "node:assert/strict";

import { cachedFetchJson, fetchJson, fetchManifest, dataRelativeKey } from "../data-cache.js";

// --- Stubs ----------------------------------------------------------------

function installStubs({ bodies = {}, failFetch = false, noCaches = false,
                        putThrows = false, putPoisonsBody = false } = {}) {
  const calls = { fetch: [], put: [], delete: [] };
  const store = new Map();       // url -> serialized body (the Cache Storage stand-in)
  const corruptCached = new Set(); // urls whose stored body reads back as an error
  const local = new Map();       // the localStorage stand-in

  const saved = {
    fetch: globalThis.fetch,
    caches: globalThis.caches,
    localStorage: globalThis.localStorage,
  };

  globalThis.fetch = async (url) => {
    calls.fetch.push(url);
    if (failFetch) throw new Error("offline");
    if (!(url in bodies)) return { ok: false, status: 404, json: async () => ({}) };
    return response(bodies[url]);
  };

  /* A response and its clones share one body, the way a real one does: clone()
   * tees a single stream into two, so whatever kills one branch kills both.
   * `stream.dead` is that shared fate — see the putPoisonsBody test for why
   * modelling it matters. */
  function response(body, stream = { dead: false }) {
    const text = JSON.stringify(body);
    const read = async () => {
      if (stream.dead) throw new TypeError("Failed to fetch");
      return text;
    };
    return {
      ok: true, status: 200, stream,
      text: read,
      json: async () => JSON.parse(await read()),
      clone: () => response(body, stream),
    };
  }

  globalThis.caches = noCaches ? undefined : {
    open: async () => ({
      match: async (url) => {
        if (!store.has(url)) return undefined;
        // A stored body that can't be read back: a write truncated by a dropped
        // connection, an entry evicted mid-read, a storage-layer error.
        if (corruptCached.has(url)) {
          return { ok: true, status: 200, stream: {},
                   text: async () => { throw new TypeError("Failed to read cached response"); },
                   json: async () => { throw new TypeError("Failed to read cached response"); },
                   clone() { return this; } };
        }
        return response(store.get(url));
      },
      delete: async (url) => { calls.delete.push(url); corruptCached.delete(url); return store.delete(url); },
      put: async (url, res) => {
        calls.put.push(url);
        // Cache.put() reads the body it is handed. A write that dies partway
        // leaves that stream — and so its twin — unreadable.
        if (putPoisonsBody) {
          if (res.stream) res.stream.dead = true;
          throw new TypeError("Cache.put() encountered a network error");
        }
        if (putThrows) throw new Error("quota exceeded");
        store.set(url, await res.json());
      },
    }),
  };

  globalThis.localStorage = {
    getItem: (k) => (local.has(k) ? local.get(k) : null),
    setItem: (k, v) => local.set(k, v),
  };

  return {
    calls,
    seed: (url, body) => store.set(url, body),
    corrupt: (url) => corruptCached.add(url),
    stamps: () => JSON.parse(local.get("edfringe.data.fetched.v1") || "{}"),
    restore: () => {
      globalThis.fetch = saved.fetch;
      globalThis.caches = saved.caches;
      globalThis.localStorage = saved.localStorage;
    },
  };
}

const URL_A = "data/normalized/availability.min.json";
const KEY_A = "normalized/availability.min.json"; // dataRelativeKey(URL_A)

/** A manifest object naming one hash for URL_A (or whatever key is given). */
const manifestOf = (hash, key = KEY_A) => ({ v: 1, files: { [key]: hash } });

// --- dataRelativeKey --------------------------------------------------------

test("dataRelativeKey resolves both pages' spellings to the same manifest key", () => {
  // js/app.js fetches "data/…"; plan/plan.js fetches "../data/…" (one
  // directory down). Both must land on the same key so one manifest serves
  // both pages' Cache Storage entries.
  assert.equal(dataRelativeKey("data/venues.json"), "venues.json");
  assert.equal(dataRelativeKey("../data/venues.json"), "venues.json");
  assert.equal(dataRelativeKey("../data/normalized/shows.min.json"), "normalized/shows.min.json");
  assert.equal(dataRelativeKey("data/days/2026-08-07.json"), "days/2026-08-07.json");
});

test("dataRelativeKey returns null for a url with no data segment", () => {
  assert.equal(dataRelativeKey("favicon.ico"), null);
  assert.equal(dataRelativeKey("../shared/geo.js"), null);
});

// --- fetchManifest -----------------------------------------------------------

test("fetchManifest returns the parsed manifest on success", async () => {
  const s = installStubs({ bodies: { "data/manifest.json": manifestOf("abc") } });
  try {
    assert.deepEqual(await fetchManifest("data/manifest.json"), manifestOf("abc"));
  } finally {
    s.restore();
  }
});

test("fetchManifest returns null and logs, rather than throwing, on failure", async () => {
  const s = installStubs({ failFetch: true });
  try {
    const notes = [];
    assert.equal(await fetchManifest("data/manifest.json", (err, url) => notes.push(url)), null);
    assert.deepEqual(notes, ["data/manifest.json"]);
  } finally {
    s.restore();
  }
});

// --- cachedFetchJson ---------------------------------------------------------

test("a hash the manifest still names is served from cache without touching the network", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1")), { v: 1 });
    assert.equal(s.calls.fetch.length, 1, "the first call must go to the network");

    // Same manifest, same hash — a later load, any amount of time on.
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1")), { v: 1 });
    assert.equal(s.calls.fetch.length, 1, "a matching hash must not re-fetch");
  } finally {
    s.restore();
  }
});

test("a moved manifest hash forces a re-fetch and the copy is replaced", async () => {
  const bodies = { [URL_A]: { v: 1 } };
  const s = installStubs({ bodies });
  try {
    await cachedFetchJson(URL_A, manifestOf("h1"));
    bodies[URL_A] = { v: 2 }; // the published file changed
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h2")), { v: 2 });
    assert.equal(s.calls.fetch.length, 2);

    // ...and the replacement, stamped under the new hash, is what the next
    // matching-hash read gets.
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h2")), { v: 2 });
    assert.equal(s.calls.fetch.length, 2);
  } finally {
    s.restore();
  }
});

test("each url tracks its own hash, so one file's change doesn't refetch another", async () => {
  const catalogue = "data/normalized/shows.min.json";
  const catKey = "normalized/shows.min.json";
  const s = installStubs({ bodies: { [catalogue]: [1], [URL_A]: { v: 1 } } });
  try {
    const bothFresh = { v: 1, files: { [catKey]: "cat-h1", [KEY_A]: "avail-h1" } };
    await cachedFetchJson(catalogue, bothFresh);
    await cachedFetchJson(URL_A, bothFresh);
    assert.equal(s.calls.fetch.length, 2);

    // Only availability's hash moves.
    const availMoved = { v: 1, files: { [catKey]: "cat-h1", [KEY_A]: "avail-h2" } };
    await cachedFetchJson(catalogue, availMoved);
    await cachedFetchJson(URL_A, availMoved);
    assert.deepEqual(s.calls.fetch, [catalogue, URL_A, URL_A],
      "only the url whose hash moved may be re-fetched");
  } finally {
    s.restore();
  }
});

test("with no manifest, freshness is unknown, so the cache is never trusted", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    await cachedFetchJson(URL_A, manifestOf("h1")); // populate + stamp under h1
    assert.equal(s.calls.fetch.length, 1);

    // A manifest fetch that failed upstream is passed through as null — never
    // "nothing changed". Must always go to the network, not read the cache.
    assert.deepEqual(await cachedFetchJson(URL_A, null), { v: 1 });
    assert.equal(s.calls.fetch.length, 2, "a null manifest must never be treated as a match");
    assert.deepEqual(s.stamps(), {}, "an url fetched with no known hash must not be stamped");
  } finally {
    s.restore();
  }
});

test("a file the manifest doesn't (yet) name is always fetched, never trusted from cache", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    // The manifest is real but says nothing about this url.
    const manifest = { v: 1, files: { "venues.json": "unrelated" } };
    await cachedFetchJson(URL_A, manifest);
    await cachedFetchJson(URL_A, manifest);
    assert.equal(s.calls.fetch.length, 2, "an unlisted file must not be served from cache");
  } finally {
    s.restore();
  }
});

test("a failed re-fetch falls back to the stale copy rather than throwing", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    await cachedFetchJson(URL_A, manifestOf("h1"));
    s.restore();

    // Same store, now with a dead network and a manifest that has moved on —
    // the stamp map was reset with the stubs, so this is the
    // has-nothing-fresh path: it tries the network, fails, and must still
    // answer from whatever is cached regardless of the hash mismatch.
    const offline = installStubs({ failFetch: true });
    offline.seed(URL_A, { v: 1 });
    const notes = [];
    try {
      assert.deepEqual(
        await cachedFetchJson(URL_A, manifestOf("h2"), (err, url) => notes.push(url)),
        { v: 1 }, "yesterday's availability beats an error page");
      assert.deepEqual(notes, [URL_A], "the fallback must be reported to the caller's log");
    } finally {
      offline.restore();
    }
  } finally {
    s.restore();
  }
});

test("a failed fetch with nothing cached throws — there is nothing to draw", async () => {
  const s = installStubs({ failFetch: true });
  try {
    await assert.rejects(() => cachedFetchJson(URL_A, manifestOf("h1")), /offline/);
  } finally {
    s.restore();
  }
});

test("without Cache Storage it degrades to a plain fetch, every time", async () => {
  // file:// and plain http get no Cache Storage. The page must still work.
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } }, noCaches: true });
  try {
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1")), { v: 1 });
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1")), { v: 1 });
    assert.equal(s.calls.fetch.length, 2, "no cache means no reuse, not an error");
  } finally {
    s.restore();
  }
});

test("a cache write that fails still returns the data, and doesn't stamp it fresh", async () => {
  // Private mode / full quota. The caller got its answer; the only cost is that
  // the next visit re-fetches.
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } }, putThrows: true });
  try {
    const notes = [];
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1"), (err, url) => notes.push(url)), { v: 1 });
    assert.deepEqual(notes, [URL_A]);
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1")), { v: 1 });
    assert.equal(s.calls.fetch.length, 2, "an unstamped url must be re-fetched");
  } finally {
    s.restore();
  }
});

test("a cache write that dies mid-body must not cost the caller its download", async () => {
  // The regression behind the "every show is sold out" planner (#309). Cache.put()
  // consumes the body it is given, and clone() tees one stream into two — so a put
  // that fails partway errors the response we still have to read. Writing to the
  // cache before reading the payload therefore threw away a download that had
  // already succeeded: availability.min.json went missing, every performance
  // became status-unknown, and the grid drew all 4,122 shows as unavailable.
  //
  // The cache write may fail. Losing the data because of it may not.
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } }, putPoisonsBody: true });
  try {
    const notes = [];
    assert.deepEqual(
      await cachedFetchJson(URL_A, manifestOf("h1"), (err, url) => notes.push(url)), { v: 1 },
      "the payload was downloaded intact — a failed cache write must not discard it");
    assert.deepEqual(notes, [URL_A], "the write that failed is still worth logging");
  } finally {
    s.restore();
  }
});

test("an unreadable cached copy falls through to the network instead of throwing", async () => {
  // The production failure in #309, and the half of it the first fix missed. The
  // network panel for the broken page showed NO request for any data file: all
  // four were served from Cache Storage. So the read that failed was the *cache*
  // read, and that path had no fall-through — a truncated or unreadable entry
  // propagated straight out, and because the stamp stayed fresh it failed
  // identically on every load until the manifest hash happened to move.
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    await cachedFetchJson(URL_A, manifestOf("h1"));            // populate + stamp
    assert.equal(s.calls.fetch.length, 1);
    s.corrupt(URL_A);                                // the entry goes bad in place

    const notes = [];
    assert.deepEqual(await cachedFetchJson(URL_A, manifestOf("h1"), (err, url) => notes.push(url)), { v: 1 },
      "a cached copy we can't read is a miss, not a failure");
    assert.equal(s.calls.fetch.length, 2, "the network must be asked when the cache can't answer");
    assert.deepEqual(notes, [URL_A], "the unreadable entry is worth logging");
    assert.deepEqual(s.calls.delete, [URL_A], "and worth evicting, so it can't fail again next load");
  } finally {
    s.restore();
  }
});

test("a cached copy of the wrong shape is refetched rather than trusted", async () => {
  // The other way a cache read produces no data and no error: an entry from an
  // older generation of the file. It parses, so nothing throws — it simply joins
  // to nothing downstream, which the planner drew as "every show unavailable".
  // The sidecar carries a `v` for exactly this; the caller knows the schema, so
  // the caller gets to reject the copy.
  const isSidecar = (d) => Boolean(d) && d.v === 1 && d.a && Object.keys(d.a).length > 0;
  const s = installStubs({ bodies: { [URL_A]: { v: 1, a: { SHOW: {} } } } });
  try {
    s.seed(URL_A, { version: 1, shows: {} });        // a previous generation's shape
    localStorage.setItem("edfringe.data.fetched.v1", JSON.stringify({ [URL_A]: "h1" }));

    const notes = [];
    assert.deepEqual(
      await cachedFetchJson(URL_A, manifestOf("h1"), (err, url) => notes.push(url), isSidecar),
      { v: 1, a: { SHOW: {} } }, "a copy that fails validation must not be served");
    assert.equal(s.calls.fetch.length, 1, "it goes to the network instead");
    assert.deepEqual(s.calls.delete, [URL_A]);
    assert.deepEqual(s.stamps(), { [URL_A]: "h1" },
      "and the fresh copy is stamped in its place");
  } finally {
    s.restore();
  }
});

test("a validator that rejects the network's answer too surfaces the error", async () => {
  // Belt and braces: if neither the cache nor the network can produce something
  // usable, that is a real failure and must be raised, not papered over.
  const s = installStubs({ bodies: { [URL_A]: { v: 0 } } });
  try {
    await assert.rejects(
      () => cachedFetchJson(URL_A, manifestOf("h1"), undefined, (d) => d.v === 1),
      /failed validation/);
  } finally {
    s.restore();
  }
});

test("an unreadable stale copy doesn't mask the network error behind it", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    await cachedFetchJson(URL_A, manifestOf("h1"));
    s.restore();

    const offline = installStubs({ failFetch: true });
    offline.seed(URL_A, { v: 1 });
    offline.corrupt(URL_A);
    try {
      // The fallback read fails too — the caller must hear about the network,
      // not about the cache.
      await assert.rejects(() => cachedFetchJson(URL_A, manifestOf("h2"), () => {}), /offline/);
    } finally {
      offline.restore();
    }
  } finally {
    s.restore();
  }
});

test("fetchJson turns a non-ok response into an error naming the url", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  try {
    await assert.rejects(() => fetchJson("data/venues.json"), /HTTP 404 fetching data\/venues\.json/);
  } finally {
    globalThis.fetch = saved;
  }
});
