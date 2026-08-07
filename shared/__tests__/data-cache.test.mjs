// Tests for the TTL data cache (shared/data-cache.js).
//
// This is the whole of the site's freshness policy — GitHub Pages won't let us
// set Cache-Control per file, so the decision of how long each data file may be
// reused lives here. The behaviours worth pinning down are the ones that fail
// quietly in a browser: a TTL that doesn't actually suppress the network, an
// expiry that doesn't actually re-fetch, and the fallbacks (no Cache Storage, a
// dead network, a full quota) that must still hand the caller its data.
//
// Cache Storage and localStorage don't exist in Node, so both are stubbed. The
// stubs are deliberately thin: `caches.open` returning a `{match, put}` pair is
// the entire surface the module uses.

import { test } from "node:test";
import assert from "node:assert/strict";

import { cachedFetchJson, fetchJson, DAY_MS } from "../data-cache.js";

// --- Stubs ----------------------------------------------------------------

function installStubs({ bodies = {}, failFetch = false, noCaches = false,
                        putThrows = false, now = 1_000_000 } = {}) {
  const calls = { fetch: [], put: [] };
  const store = new Map();       // url -> serialized body (the Cache Storage stand-in)
  const local = new Map();       // the localStorage stand-in

  const saved = {
    fetch: globalThis.fetch,
    caches: globalThis.caches,
    localStorage: globalThis.localStorage,
    now: Date.now,
  };

  globalThis.fetch = async (url) => {
    calls.fetch.push(url);
    if (failFetch) throw new Error("offline");
    return response(bodies[url]);
  };

  function response(body) {
    const text = JSON.stringify(body);
    return { ok: true, status: 200, json: async () => JSON.parse(text), clone: () => response(body) };
  }

  globalThis.caches = noCaches ? undefined : {
    open: async () => ({
      match: async (url) => (store.has(url) ? response(store.get(url)) : undefined),
      put: async (url, res) => {
        calls.put.push(url);
        if (putThrows) throw new Error("quota exceeded");
        store.set(url, await res.json());
      },
    }),
  };

  globalThis.localStorage = {
    getItem: (k) => (local.has(k) ? local.get(k) : null),
    setItem: (k, v) => local.set(k, v),
  };

  const clock = { now };
  Date.now = () => clock.now;

  return {
    calls,
    clock,
    seed: (url, body) => store.set(url, body),
    restore: () => {
      globalThis.fetch = saved.fetch;
      globalThis.caches = saved.caches;
      globalThis.localStorage = saved.localStorage;
      Date.now = saved.now;
    },
  };
}

const URL_A = "data/normalized/availability.min.json";

// --- Tests ----------------------------------------------------------------

test("inside the TTL the cached copy is served without touching the network", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 1 });
    assert.equal(s.calls.fetch.length, 1, "the first call must go to the network");

    // Most of a day later, still inside the TTL.
    s.clock.now += DAY_MS - 1;
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 1 });
    assert.equal(s.calls.fetch.length, 1, "a hit inside the TTL must not re-fetch");
  } finally {
    s.restore();
  }
});

test("past the TTL the network is asked again and the copy is replaced", async () => {
  const bodies = { [URL_A]: { v: 1 } };
  const s = installStubs({ bodies });
  try {
    await cachedFetchJson(URL_A, DAY_MS);
    s.clock.now += DAY_MS + 1;
    bodies[URL_A] = { v: 2 }; // the festival moved on
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 2 });
    assert.equal(s.calls.fetch.length, 2);

    // ...and the replacement is what the next in-TTL read gets.
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 2 });
    assert.equal(s.calls.fetch.length, 2);
  } finally {
    s.restore();
  }
});

test("each url carries its own clock, so a long TTL can't shelter a short one", async () => {
  // The catalogue is held for days while availability is held for one. They
  // share a cache; they must not share an expiry.
  const catalogue = "data/normalized/shows.min.json";
  const s = installStubs({ bodies: { [catalogue]: [1], [URL_A]: { v: 1 } } });
  try {
    await cachedFetchJson(catalogue, 4 * DAY_MS);
    await cachedFetchJson(URL_A, DAY_MS);
    assert.equal(s.calls.fetch.length, 2);

    s.clock.now += DAY_MS + 1; // past availability's TTL, well inside the catalogue's
    await cachedFetchJson(catalogue, 4 * DAY_MS);
    await cachedFetchJson(URL_A, DAY_MS);
    assert.deepEqual(s.calls.fetch, [catalogue, URL_A, URL_A],
      "only the expired url may be re-fetched");
  } finally {
    s.restore();
  }
});

test("a failed re-fetch falls back to the stale copy rather than throwing", async () => {
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } } });
  try {
    await cachedFetchJson(URL_A, DAY_MS);
    s.restore();

    // Same store, now with a dead network.
    const offline = installStubs({ failFetch: true, now: 1_000_000 + DAY_MS + 1 });
    offline.seed(URL_A, { v: 1 });
    // The stamp map was reset with the stubs, so this is the has-nothing-fresh
    // path: it tries the network, fails, and must still answer.
    const notes = [];
    try {
      assert.deepEqual(
        await cachedFetchJson(URL_A, DAY_MS, (err, url) => notes.push(url)),
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
    await assert.rejects(() => cachedFetchJson(URL_A, DAY_MS), /offline/);
  } finally {
    s.restore();
  }
});

test("without Cache Storage it degrades to a plain fetch, every time", async () => {
  // file:// and plain http get no Cache Storage. The page must still work.
  const s = installStubs({ bodies: { [URL_A]: { v: 1 } }, noCaches: true });
  try {
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 1 });
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 1 });
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
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS, (err, url) => notes.push(url)), { v: 1 });
    assert.deepEqual(notes, [URL_A]);
    assert.deepEqual(await cachedFetchJson(URL_A, DAY_MS), { v: 1 });
    assert.equal(s.calls.fetch.length, 2, "an unstamped url must be re-fetched");
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
