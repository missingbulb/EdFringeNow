// Node test for the pure JS port of the Python favourites/availability/
// scheduling logic. No dependencies — plain node:test + node:assert.
// Run from /workspace/edfringenow with:
//   node plan/lib/__tests__/engine.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseFavourites } from "../favourites.js";
import { buildIndex, matchFavourites, summarize, compatible } from "../engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOWS_PATH = path.join(__dirname, "..", "..", "..", "data", "normalized", "shows.json");
const FAVOURITES_CSV_PATH = path.join(__dirname, "..", "..", "sample-favourites.csv");

const shows = JSON.parse(readFileSync(SHOWS_PATH, "utf-8"));
const favouritesCsvText = readFileSync(FAVOURITES_CSV_PATH, "utf-8");

test("parseFavourites extracts exactly the one slug from the sample CSV", () => {
  const slugs = parseFavourites(favouritesCsvText);
  assert.deepEqual(slugs, ["100-badgers-with-matt-hobs"]);
});

test("matchFavourites finds the show and it has performances", () => {
  const slugs = parseFavourites(favouritesCsvText);
  const index = buildIndex(shows);
  const { matched, missingSlugs } = matchFavourites(slugs, index);

  assert.equal(missingSlugs.length, 0);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].title, "100% Badgers with Matt Hobs");
  assert.ok(matched[0].performances.length > 0, "matched show should have performances");
});

test("summarize counts the show as available within an in-range window", () => {
  const slugs = parseFavourites(favouritesCsvText);
  const index = buildIndex(shows);
  const { matched } = matchFavourites(slugs, index);

  const result = summarize(matched, {
    dateStart: "2026-08-06",
    dateEnd: "2026-08-10",
    startTimeMin: "12:00",
    startTimeMax: "23:00",
  });

  console.log("summarize (in-window) counts:", result.counts);
  assert.equal(result.counts.totalFavourites, 1);
  assert.equal(result.counts.matchedShows, 1);
  assert.equal(result.counts.showsAvailableInWindow, 1);

  const showSummary = result.shows[0];
  const inWindowPerfs = showSummary.performances.filter((p) => p.inWindow);
  assert.ok(inWindowPerfs.length > 0);
  assert.ok(showSummary.availableDateSpan, "should expose an available date span");
  assert.equal(showSummary.availableDateSpan.min, "2026-08-06");
});

test("summarize counts zero shows available for a window with no performances", () => {
  const slugs = parseFavourites(favouritesCsvText);
  const index = buildIndex(shows);
  const { matched } = matchFavourites(slugs, index);

  const result = summarize(matched, {
    dateStart: "2026-07-01",
    dateEnd: "2026-07-31",
    startTimeMin: "00:00",
    startTimeMax: "23:59",
  });

  console.log("summarize (July, no performances) counts:", result.counts);
  assert.equal(result.counts.showsAvailableInWindow, 0);
});

test("compatible: two shows 30 min apart at different venues are compatible", () => {
  const a = { start: 0, end: 60, venueCode: "V1" };
  const b = { start: 90, end: 150, venueCode: "V2" }; // starts 30 min after `a` ends
  assert.equal(compatible(a, b), true);
  assert.equal(compatible(b, a), true); // order-independent
});

test("compatible: overlapping performances are not compatible", () => {
  const a = { start: 0, end: 60, venueCode: "V1" };
  const b = { start: 30, end: 90, venueCode: "V2" }; // overlaps `a`
  assert.equal(compatible(a, b), false);
});

test("compatible: same-venue back-to-back (0 gap) is compatible, different-venue is not", () => {
  const a = { start: 0, end: 60, venueCode: "SAME" };
  const b = { start: 60, end: 120, venueCode: "SAME" }; // 0 min gap, same venue
  assert.equal(compatible(a, b), true);

  const c = { start: 0, end: 60, venueCode: "V1" };
  const d = { start: 60, end: 120, venueCode: "V2" }; // 0 min gap, different venue
  assert.equal(compatible(c, d), false);
});
