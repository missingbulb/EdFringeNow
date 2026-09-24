import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildPool, festivalOf, poolId, daysOf, shiftDay } from "../pool.js";
import { adaptFestival } from "../../../shared/festival-catalogue.js";
import { draftCalendar } from "../../../plan/lib/contention.js";

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const readJson = (rel) => JSON.parse(readFileSync(path.join(SITE, rel), "utf8"));

test("ids are namespaced by festival and read back", () => {
  assert.equal(poolId("acco", "main"), "acco/main");
  assert.equal(festivalOf("acco/main"), "acco");
  assert.equal(festivalOf("bare"), null);
});

test("days and shifts", () => {
  assert.deepEqual(daysOf("2026-09-30", "2026-10-02"), ["2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.equal(shiftDay("2026-10-01", -1), "2026-09-30");
});

test("only reachable nights join the pool, and an out edition joins nothing", () => {
  const catalogue = {
    festival: { id: "f" },
    shows: [
      {
        slug: "s",
        genreSlugs: ["k"],
        venue: "v",
        performances: [
          { date: "2026-10-01", venue: "v" },
          { date: "2026-10-05", venue: "v" },
        ],
      },
    ],
    venues: new Map([["v", { name: "V" }]]),
    categories: [
      { slug: "k", name: "K" },
      { slug: "unused", name: "U" },
    ],
  };
  const pool = buildPool([{ catalogue, reach: { verdict: "partly", nights: [{ from: "2026-10-01", to: "2026-10-02" }] } }]);
  assert.equal(pool.shows[0].slug, "f/s");
  assert.deepEqual(
    pool.shows[0].performances.map((p) => p.date),
    ["2026-10-01"]
  );
  assert.equal(pool.shows[0].performances[0].venue, "f/v");
  assert.deepEqual(
    pool.categories.map((c) => c.slug),
    ["f/k"]
  );
  assert.equal(buildPool([{ catalogue, reach: { verdict: "out", nights: [] } }]).shows.length, 0);
});

// The small festivals this page is for must plan at once with every show
// starred: each committed edition is pooled and drafted inside a budget no
// reader would notice.
test("every committed edition pools and drafts, every show starred, within a second", () => {
  const registry = readJson("data/festivals/index.json");
  let drafted = 0;
  for (const festival of registry.festivals) {
    for (const edition of festival.editions) {
      if (!edition.dataUrl) continue;
      const started = performance.now();
      const catalogue = adaptFestival(readJson(edition.dataUrl.replace(/^\//, "")));
      const reach = { verdict: "focus", nights: [{ from: edition.firstDate, to: edition.lastDate }] };
      const pool = buildPool([{ catalogue, reach }]);
      assert.ok(pool.shows.length > 0, `${festival.id}@${edition.id} has shows`);
      draftCalendar(pool.shows, { favourites: pool.shows.map((s) => s.slug) });
      const ms = performance.now() - started;
      assert.ok(ms < 1000, `${festival.id}@${edition.id} took ${Math.round(ms)}ms`);
      drafted += 1;
    }
  }
  assert.ok(drafted >= 1);
});
