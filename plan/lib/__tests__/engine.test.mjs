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
import { buildIndex, matchFavourites, summarize, compatible, buildSchedule } from "../engine.js";

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

// --- buildSchedule -------------------------------------------------------

// Two synthetic shows that clash on Aug 10 (both 19:00) but each also have a
// non-clashing performance, so a good allocator can fit both.
const CLASH_SHOWS = [
  {
    slug: "show-a",
    title: "Show A",
    genre: "Comedy",
    duration: 60,
    venue: "V1",
    venueName: "Venue One",
    performances: [
      { date: "2026-08-10", start: "19:00", soldOut: false, status: "TICKETS_AVAILABLE" },
      { date: "2026-08-11", start: "19:00", soldOut: false, status: "TICKETS_AVAILABLE" },
    ],
  },
  {
    slug: "show-b",
    title: "Show B",
    genre: "Theatre",
    duration: 60,
    venue: "V2",
    venueName: "Venue Two",
    performances: [
      { date: "2026-08-10", start: "19:00", soldOut: false, status: "TICKETS_AVAILABLE" },
      { date: "2026-08-10", start: "21:00", soldOut: false, status: "TICKETS_AVAILABLE" },
    ],
  },
];

test("buildSchedule: places every show when a conflict-free slot exists", () => {
  const result = buildSchedule(CLASH_SHOWS, {
    windowStart: "2026-08-10T00:00",
    windowEnd: "2026-08-11T23:59",
  });
  assert.equal(result.counts.scheduledShows, 2);
  assert.equal(result.unscheduled.length, 0);
  // One performance per show, no two same-day slots overlapping.
  const slugs = result.scheduled.map((s) => s.slug).sort();
  assert.deepEqual(slugs, ["show-a", "show-b"]);
});

test("buildSchedule: maxPerDay caps a single day and reports the overflow", () => {
  const result = buildSchedule(CLASH_SHOWS, {
    windowStart: "2026-08-10T00:00",
    windowEnd: "2026-08-10T23:59", // only Aug 10 is in-window now
    maxPerDay: 1,
  });
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].slots.length, 1);
  assert.equal(result.counts.scheduledShows, 1);
  assert.equal(result.unscheduled.length, 1);
});

test("buildSchedule: minGap keeps two same-day shows far enough apart", () => {
  // Both shows only run 19:00 & 21:00 on Aug 10 (2h apart, 1h each = 1h gap).
  // A 90-min minimum gap makes them incompatible → only one fits.
  const tight = buildSchedule(CLASH_SHOWS, {
    windowStart: "2026-08-10T00:00",
    windowEnd: "2026-08-10T23:59",
    minGapDifferentVenue: 90,
  });
  assert.equal(tight.counts.scheduledShows, 1);
  // A 30-min gap leaves them compatible → both fit on the one day.
  const loose = buildSchedule(CLASH_SHOWS, {
    windowStart: "2026-08-10T00:00",
    windowEnd: "2026-08-10T23:59",
    minGapDifferentVenue: 30,
  });
  assert.equal(loose.counts.scheduledShows, 2);
});

test("buildSchedule: minPerDay drops an under-populated day", () => {
  const result = buildSchedule(CLASH_SHOWS, {
    windowStart: "2026-08-11T00:00",
    windowEnd: "2026-08-11T23:59", // only Show A's Aug 11 perf is in-window
    minPerDay: 2,
  });
  assert.equal(result.counts.scheduledShows, 0);
  const dropped = result.unscheduled.find((u) => u.slug === "show-a");
  assert.ok(dropped, "show-a should be unscheduled");
  assert.match(dropped.reason, /minimum/);
});

test("buildSchedule: a show with no in-window performance is reported unscheduled", () => {
  const result = buildSchedule(CLASH_SHOWS, {
    windowStart: "2026-08-20T00:00",
    windowEnd: "2026-08-20T23:59", // neither show runs Aug 20
  });
  assert.equal(result.counts.scheduledShows, 0);
  assert.equal(result.unscheduled.length, 2);
  assert.ok(result.unscheduled.every((u) => /no available performance/.test(u.reason)));
});

test("buildSchedule: is deterministic — same inputs, same plan", () => {
  const opts = { windowStart: "2026-08-10T00:00", windowEnd: "2026-08-11T23:59" };
  const a = buildSchedule(CLASH_SHOWS, opts);
  const b = buildSchedule(CLASH_SHOWS, opts);
  assert.deepEqual(a.scheduled, b.scheduled);
});

test("buildSchedule: schedules real favourites within the default window", () => {
  const slugs = parseFavourites(favouritesCsvText);
  const index = buildIndex(shows);
  const { matched } = matchFavourites(slugs, index);
  const result = buildSchedule(matched);
  assert.ok(result.counts.scheduledShows >= 1, "the sample favourite should be schedulable");
  // Every scheduled slot carries the fields the exporters need.
  for (const slot of result.scheduled) {
    assert.equal(typeof slot.title, "string");
    assert.equal(typeof slot.start, "number");
    assert.equal(typeof slot.end, "number");
    assert.ok(slot.end >= slot.start);
  }
});
