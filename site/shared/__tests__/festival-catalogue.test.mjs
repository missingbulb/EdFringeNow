import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { adaptFestival, currentEdition } from "../festival-catalogue.js";

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (rel) => JSON.parse(readFileSync(path.join(SITE, rel), "utf8"));

test("every edition the registry offers loads through the adapter on the real committed files", () => {
  const index = readJson("data/festivals/index.json");
  let loaded = 0;
  for (const festival of index.festivals) {
    for (const edition of festival.editions) {
      if (!edition.dataUrl) continue;
      const file = path.join(SITE, edition.dataUrl);
      assert.ok(existsSync(file), `${edition.dataUrl} exists under site/`);
      const catalogue = adaptFestival(JSON.parse(readFileSync(file, "utf8")));
      assert.equal(catalogue.festival.id, festival.id);
      assert.equal(catalogue.festival.edition, edition.id);
      assert.ok(catalogue.shows.length > 0, `${festival.id} ${edition.id} has shows`);
      for (const show of catalogue.shows) {
        assert.ok(show.performances.length > 0, `${show.slug} has performances`);
        for (const p of show.performances) {
          assert.ok(p.venue == null || catalogue.venues.has(p.venue), `${show.slug}: venue ${p.venue} resolves`);
        }
      }
      loaded += 1;
    }
  }
  assert.ok(loaded >= 1, "the sweep covered at least the Jerusalem edition");
});

test("availability: only sold-out stops scheduling; unknown is available, free stays free", () => {
  const block = readJson("data/festivals/jerusalem-comedy/2026.json");
  const engineOf = (over) => {
    const p = { ...block.performances[0], ...over };
    const one = { ...block, performances: [p], events: block.events.filter((e) => e.id === p.eventId) };
    return adaptFestival(one).shows[0].performances[0];
  };
  assert.equal(engineOf({ status: "unknown", free: false }).status, "TICKETS_AVAILABLE");
  assert.equal(engineOf({ status: "unknown", free: null }).status, "TICKETS_AVAILABLE");
  assert.equal(engineOf({ status: "unknown", free: true }).status, "FREE_NON_TICKETED");
  const sold = engineOf({ status: "sold-out", free: false });
  assert.equal(sold.status, "SOLD_OUT");
  assert.equal(sold.soldOut, true);
  assert.equal(engineOf({ status: "on-sale", free: false }).soldOut, false);
});

test("a local-language title rides on the show when the block has one, and is absent when it is null", () => {
  const block = readJson("data/festivals/haifa-iff/2026.json");
  const shows = new Map(adaptFestival(block).shows.map((s) => [s.slug, s]));
  const withLocal = block.events.filter((e) => e.titleLocal != null);
  assert.ok(withLocal.length > 0);
  for (const event of block.events) {
    const show = shows.get(event.id);
    assert.equal(show.title, event.title);
    if (event.titleLocal != null) assert.equal(show.titleLocal, event.titleLocal);
    else assert.ok(!("titleLocal" in show), `${event.id} carries no titleLocal`);
  }
});

test("a block from another schema version is refused, not half-read", () => {
  const block = readJson("data/festivals/jerusalem-comedy/2026.json");
  assert.throws(() => adaptFestival({ ...block, v: 2 }), /schema v2/);
  assert.throws(() => adaptFestival({ ...block, v: undefined }), /schema v/);
});

test("currentEdition: running, else next, else most recent; editions without data never", () => {
  const entry = {
    editions: [
      { id: "2025", firstDate: "2025-10-19", lastDate: "2025-10-23", dataUrl: "/a" },
      { id: "2026", firstDate: "2026-10-18", lastDate: "2026-10-22", dataUrl: "/b" },
      { id: "2027", firstDate: "2027-10-17", lastDate: "2027-10-21", dataUrl: null },
    ],
  };
  assert.equal(currentEdition(entry, "2026-10-20").id, "2026");
  // On both boundaries the edition is running, not next or past.
  assert.equal(currentEdition(entry, "2025-10-19").id, "2025");
  assert.equal(currentEdition(entry, "2025-10-23").id, "2025");
  assert.equal(currentEdition(entry, "2025-10-24").id, "2026");
  assert.equal(currentEdition(entry, "2026-01-01").id, "2026");
  // 2027 has no data, so after 2026 ends the most recent loadable one is 2026.
  assert.equal(currentEdition(entry, "2027-10-18").id, "2026");
  assert.equal(currentEdition({ editions: [{ id: "x", dataUrl: null }] }, "2026-01-01"), null);
});
