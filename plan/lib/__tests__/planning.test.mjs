// Tests for the planner's new scheduling logic: travel-time gaps, the
// day-hours window, meal breaks, and forced (must-see) scheduling. Plain
// node:test + node:assert, no dependencies.
//   node --test plan/lib/__tests__/planning.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSchedule,
  eligibleSlots,
  slotKey,
  requiredGapMinutes,
  compatible,
  withinDayWindow,
  normalizeMealBreaks,
  festivalNight,
  placementDiagnostics,
} from "../engine.js";
import { distanceKm, travelMinutes, TRAVEL_SPEED_KMH } from "../travel.js";

// --- Fixtures ------------------------------------------------------------

// Two venues ~2 km apart (same longitude, ~0.018° of latitude ≈ 2 km at
// Edinburgh). At that distance a walk (≈36 min) exceeds the 30-min flat buffer
// but a bike/car (≈8/≈5 min) does not — the lever the travel-mode tests pull.
const VENUE_COORDS = {
  A: { lat: 55.9478, lng: -3.1861 },
  B: { lat: 55.9658, lng: -3.1861 },
  ONLINE: { lat: null, lng: null },
};

function show(slug, venue, perfs, extra = {}) {
  return {
    slug,
    title: slug,
    genre: "Comedy",
    duration: 60,
    venue,
    venueName: venue,
    performances: perfs.map((p) => ({
      date: p.date ?? "2026-08-10",
      start: p.start,
      soldOut: false,
      status: p.status ?? "TICKETS_AVAILABLE",
    })),
    ...extra,
  };
}

const WIDE = { windowStart: "2026-08-01T00:00", windowEnd: "2026-08-31T23:59" };

// --- travel.js -----------------------------------------------------------

test("distanceKm: ~2 km between the two fixture venues, null when a coord is missing", () => {
  const d = distanceKm(VENUE_COORDS.A, VENUE_COORDS.B);
  assert.ok(d > 1.9 && d < 2.1, `expected ~2 km, got ${d}`);
  assert.equal(distanceKm(VENUE_COORDS.A, VENUE_COORDS.ONLINE), null);
  assert.equal(distanceKm(VENUE_COORDS.A, null), null);
});

test("travelMinutes: walk slower than bike slower than car; null on missing coords", () => {
  const walk = travelMinutes(VENUE_COORDS.A, VENUE_COORDS.B, "walk");
  const bike = travelMinutes(VENUE_COORDS.A, VENUE_COORDS.B, "bike");
  const car = travelMinutes(VENUE_COORDS.A, VENUE_COORDS.B, "car");
  assert.ok(walk > bike && bike > car, `walk ${walk} > bike ${bike} > car ${car}`);
  assert.ok(TRAVEL_SPEED_KMH.walk < TRAVEL_SPEED_KMH.bike);
  assert.equal(travelMinutes(VENUE_COORDS.A, VENUE_COORDS.ONLINE, "walk"), null);
});

// --- requiredGapMinutes / compatible with travel -------------------------

test("requiredGapMinutes: travel time drives the different-venue gap, floored at the buffer", () => {
  const slots = eligibleSlots(
    [show("a", "A", [{ start: "12:00" }]), show("b", "B", [{ start: "14:00" }])],
    { ...WIDE, venueCoords: VENUE_COORDS }
  );
  const a = slots.get("a")[0];
  const b = slots.get("b")[0];
  const walkGap = requiredGapMinutes(a, b, { minGapDifferentVenue: 30, travelMode: "walk" });
  const carGap = requiredGapMinutes(a, b, { minGapDifferentVenue: 30, travelMode: "car" });
  assert.ok(walkGap > 30, `walk gap should exceed the 30-min floor, got ${walkGap}`);
  assert.equal(carGap, 30, "a short car hop stays at the 30-min floor");
});

test("requiredGapMinutes: unknown coords fall back to the flat buffer; same venue uses its own", () => {
  const bare = { venueCode: "A" };
  const bareOther = { venueCode: "B" };
  assert.equal(requiredGapMinutes(bare, bareOther, { minGapDifferentVenue: 25 }), 25);
  assert.equal(
    requiredGapMinutes({ venueCode: "SAME" }, { venueCode: "SAME" }, { minGapSameVenue: 0, minGapDifferentVenue: 25 }),
    0
  );
});

test("compatible: travel mode flips a borderline different-venue pairing", () => {
  const slots = eligibleSlots(
    [show("a", "A", [{ start: "19:00" }]), show("b", "B", [{ start: "20:33" }])],
    { ...WIDE, venueCoords: VENUE_COORDS }
  );
  const a = slots.get("a")[0]; // 19:00–20:00
  const b = slots.get("b")[0]; // 20:33–21:33  → 33-min real gap
  assert.equal(compatible(a, b, { minGapDifferentVenue: 30, travelMode: "walk" }), false);
  assert.equal(compatible(a, b, { minGapDifferentVenue: 30, travelMode: "car" }), true);
});

// --- day-hours window ----------------------------------------------------

test("withinDayWindow: start/end bounds and meal-break overlap", () => {
  const slot = { startMinuteOfDay: 780, endMinuteOfDay: 840 }; // 13:00–14:00
  assert.equal(withinDayWindow(slot, { dayStartMin: 600, dayEndMin: 1380 }), true);
  assert.equal(withinDayWindow(slot, { dayStartMin: 810 }), false, "starts before day start");
  assert.equal(withinDayWindow(slot, { dayEndMin: 810 }), false, "ends after day end");
  // Meal break 12:30–13:30 overlaps the 13:00 start.
  assert.equal(withinDayWindow(slot, { mealBreaks: [{ startMin: 750, endMin: 810 }] }), false);
  // A break that only touches the 14:00 edge does not block it.
  assert.equal(withinDayWindow(slot, { mealBreaks: [{ startMin: 840, endMin: 900 }] }), true);
});

test("buildSchedule: a show only running before day start is excluded, with a day-hours reason", () => {
  const shows = [show("early", "A", [{ start: "09:00" }])];
  const inHours = buildSchedule(shows, { ...WIDE, venueCoords: VENUE_COORDS, dayStartMin: 0 });
  assert.equal(inHours.counts.scheduledShows, 1);

  const outOfHours = buildSchedule(shows, { ...WIDE, venueCoords: VENUE_COORDS, dayStartMin: 600 });
  assert.equal(outOfHours.counts.scheduledShows, 0);
  assert.match(outOfHours.unscheduled[0].reason, /day hours|meal breaks/);
});

test("buildSchedule: a show ending after day end is excluded", () => {
  const shows = [show("late", "A", [{ start: "22:00" }])]; // 22:00–23:00 (ends at minute-of-day 1380)
  assert.equal(buildSchedule(shows, { ...WIDE, dayEndMin: 1440 }).counts.scheduledShows, 1);
  assert.equal(buildSchedule(shows, { ...WIDE, dayEndMin: 1380 }).counts.scheduledShows, 1); // ends exactly at day end — allowed
  assert.equal(buildSchedule(shows, { ...WIDE, dayEndMin: 1350 }).counts.scheduledShows, 0); // ends 23:00 > 22:30 — excluded
});

// --- meal breaks ---------------------------------------------------------

test("normalizeMealBreaks: parses HH:MM, drops disabled / malformed / zero-length", () => {
  const out = normalizeMealBreaks([
    { start: "13:00", end: "14:00" },
    { startMin: 1080, endMin: 1140 },
    { start: "18:00", end: "18:00" }, // zero length
    { start: "20:00", end: "19:00" }, // negative
    { start: "12:00", end: "13:00", enabled: false }, // off
    null,
  ]);
  assert.deepEqual(out, [
    { startMin: 780, endMin: 840 },
    { startMin: 1080, endMin: 1140 },
  ]);
});

test("buildSchedule: a meal break blocks a show that overlaps it", () => {
  const shows = [show("lunchclash", "A", [{ start: "13:00" }])]; // 13:00–14:00
  const blocked = buildSchedule(shows, { ...WIDE, mealBreaks: [{ start: "12:30", end: "13:30" }] });
  assert.equal(blocked.counts.scheduledShows, 0);
  const clear = buildSchedule(shows, { ...WIDE, mealBreaks: [{ start: "17:00", end: "18:00" }] });
  assert.equal(clear.counts.scheduledShows, 1);
});

test("buildSchedule: arrival/departure blocks only bite on their own date", () => {
  // A morning show on the arrival day and an evening show on the departure day.
  const shows = [
    show("morning", "A", [{ date: "2026-08-10", start: "10:00" }]), // 10:00–11:00
    show("evening", "A", [{ date: "2026-08-12", start: "20:00" }]), // 20:00–21:00
  ];
  const opts = { ...WIDE, dateStart: "2026-08-10", dateEnd: "2026-08-12" };

  // No blocks: both place.
  assert.equal(buildSchedule(shows, opts).counts.scheduledShows, 2);

  // "Getting there" until 12:00 on the 10th drops the morning show but leaves
  // the evening show (different date) untouched.
  const withArrival = buildSchedule(shows, {
    ...opts,
    arrival: { date: "2026-08-10", endMin: 12 * 60 },
  });
  assert.deepEqual(withArrival.scheduled.map((s) => s.slug), ["evening"]);

  // "Getting out" from 18:00 on the 12th drops the evening show; the morning
  // show (its own date has no block) still places.
  const withDeparture = buildSchedule(shows, {
    ...opts,
    departure: { date: "2026-08-12", startMin: 18 * 60 },
  });
  assert.deepEqual(withDeparture.scheduled.map((s) => s.slug), ["morning"]);
});

test("buildSchedule: the getting-there block overrides day-start on the arrival day", () => {
  // A 10:00 show on day one; a general day-start of 13:00 would bar it.
  const shows = [show("early", "A", [{ date: "2026-08-10", start: "10:00" }])]; // 10:00–11:00
  const opts = { ...WIDE, dateStart: "2026-08-10", dateEnd: "2026-08-12", dayStartMin: 13 * 60 };

  // Without a trip block the 13:00 day-start bars the 10:00 show.
  assert.equal(buildSchedule(shows, opts).counts.scheduledShows, 0);

  // A getting-there block ending at 09:00 replaces the day-start on day one, so
  // the 10:00 show now fits — an earlier first-day start than the rest of the trip.
  const withArrival = buildSchedule(shows, { ...opts, arrival: { date: "2026-08-10", endMin: 9 * 60 } });
  assert.equal(withArrival.counts.scheduledShows, 1);
});

// --- forced (must-see) scheduling ----------------------------------------

test("buildSchedule: a forced show survives the min-per-day drop", () => {
  const shows = [show("solo", "A", [{ start: "19:00" }])]; // one show, one day
  const dropped = buildSchedule(shows, { ...WIDE, minPerDay: 2 });
  assert.equal(dropped.counts.scheduledShows, 0);

  const forced = buildSchedule(shows, { ...WIDE, minPerDay: 2, forcedSlugs: ["solo"] });
  assert.equal(forced.counts.scheduledShows, 1);
  assert.deepEqual(forced.forced, ["solo"]);
});

test("buildSchedule: forcing a clashing show displaces the earliest-finish default", () => {
  // Same venue, overlapping → only one can be attended. Greedy prefers P
  // (earliest finish); forcing Q flips it.
  const shows = [
    show("p", "A", [{ start: "19:00" }]), // 19:00–20:00
    show("q", "A", [{ start: "19:30" }]), // 19:30–20:30
  ];
  const def = buildSchedule(shows, WIDE);
  assert.deepEqual(def.scheduled.map((s) => s.slug), ["p"]);

  const forced = buildSchedule(shows, { ...WIDE, forcedSlugs: ["q"] });
  assert.deepEqual(forced.scheduled.map((s) => s.slug), ["q"]);
  assert.equal(forced.unscheduled.find((u) => u.slug === "p").reason, "clashes with shows already in your plan");
});

test("buildSchedule: forced shows ignore the per-day cap", () => {
  const shows = [
    show("x", "A", [{ start: "12:00" }]),
    show("y", "A", [{ start: "14:00" }]),
    show("z", "A", [{ start: "16:00" }]),
  ];
  const forced = buildSchedule(shows, { ...WIDE, maxPerDay: 1, forcedSlugs: ["x", "y"] });
  assert.equal(forced.counts.scheduledShows, 2, "both forced shows placed despite maxPerDay 1");
  const slugs = forced.scheduled.map((s) => s.slug).sort();
  assert.deepEqual(slugs, ["x", "y"]);
});

test("buildSchedule: two hard-clashing forced shows — one placed, one reported", () => {
  const shows = [
    show("m", "A", [{ start: "19:00" }]), // 19:00–20:00
    show("n", "A", [{ start: "19:15" }]), // 19:15–20:15 overlaps m
  ];
  const forced = buildSchedule(shows, { ...WIDE, forcedSlugs: ["m", "n"] });
  assert.equal(forced.counts.scheduledShows, 1);
  const left = forced.unscheduled;
  assert.equal(left.length, 1);
  assert.match(left[0].reason, /clashes with another must-see/);
});

// --- pinning a specific performance --------------------------------------

test("slotKey: matches the identity eligibleSlots emits for a performance", () => {
  const slots = eligibleSlots([show("a", "A", [{ start: "13:30", date: "2026-08-12" }])], WIDE);
  assert.equal(slotKey(slots.get("a")[0]), "2026-08-12T13:30");
});

test("buildSchedule: forcedPerformances pins one exact performance", () => {
  const shows = [show("m", "A", [{ start: "12:00" }, { start: "20:00" }])];
  // A whole-show force takes the earliest-finishing performance (12:00)…
  const def = buildSchedule(shows, { ...WIDE, forcedSlugs: ["m"] });
  assert.equal(def.scheduled[0].startTime, "12:00");
  // …but pinning the 20:00 performance places exactly that one (no forcedSlugs).
  const pinned = buildSchedule(shows, { ...WIDE, forcedPerformances: { m: "2026-08-10T20:00" } });
  assert.equal(pinned.counts.scheduledShows, 1);
  assert.equal(pinned.scheduled[0].startTime, "20:00");
  assert.deepEqual(pinned.forced, ["m"]);
});

test("buildSchedule: a pinned performance overrides the day-hours window", () => {
  const shows = [show("late", "A", [{ start: "23:30" }])]; // 23:30–00:30
  // A day ending at 22:00 rules the show out of a whole-show force…
  const blocked = buildSchedule(shows, { ...WIDE, dayEndMin: 22 * 60, forcedSlugs: ["late"] });
  assert.equal(blocked.counts.scheduledShows, 0);
  // …but an explicit pin on that performance honours it anyway.
  const pinned = buildSchedule(shows, {
    ...WIDE,
    dayEndMin: 22 * 60,
    forcedPerformances: { late: "2026-08-10T23:30" },
  });
  assert.equal(pinned.counts.scheduledShows, 1);
  assert.equal(pinned.scheduled[0].startTime, "23:30");
});

test("buildSchedule: a pinned performance that clashes with a must-see is reported", () => {
  const shows = [
    show("p", "A", [{ start: "19:00" }]), // 19:00–20:00, forced
    show("q", "A", [{ start: "12:00" }, { start: "19:20" }]), // pin the clashing 19:20
  ];
  const out = buildSchedule(shows, {
    ...WIDE,
    forcedSlugs: ["p"],
    forcedPerformances: { q: "2026-08-10T19:20" },
  });
  // p claims 19:00 first; q, pinned to the overlapping 19:20, can't be placed —
  // and its free 12:00 slot is not a fallback, because the pin is exact.
  assert.deepEqual(out.scheduled.map((s) => s.slug), ["p"]);
  assert.match(out.unscheduled.find((u) => u.slug === "q").reason, /clashes with another must-see/);
});

// --- annotations & determinism ------------------------------------------

test("eligibleSlots: slots carry venue coords and minute-of-day annotations", () => {
  const slots = eligibleSlots([show("a", "A", [{ start: "13:30" }])], { ...WIDE, venueCoords: VENUE_COORDS });
  const s = slots.get("a")[0];
  assert.equal(s.venueLat, VENUE_COORDS.A.lat);
  assert.equal(s.venueLng, VENUE_COORDS.A.lng);
  assert.equal(s.startMinuteOfDay, 13 * 60 + 30);
  assert.equal(s.endMinuteOfDay, 14 * 60 + 30);
});

test("buildSchedule: deterministic under the new options", () => {
  const shows = [
    show("a", "A", [{ start: "12:00" }, { start: "18:00" }]),
    show("b", "B", [{ start: "13:00" }, { start: "19:00" }]),
  ];
  const opts = {
    ...WIDE,
    venueCoords: VENUE_COORDS,
    travelMode: "bike",
    dayStartMin: 600,
    dayEndMin: 1380,
    mealBreaks: [{ start: "15:00", end: "16:00" }],
    forcedSlugs: ["b"],
  };
  const first = buildSchedule(shows, opts);
  const second = buildSchedule(shows, opts);
  assert.deepEqual(first.scheduled, second.scheduled);
});

// --- after-midnight "festival night" folding -----------------------------

test("festivalNight: an after-midnight start folds onto the previous evening", () => {
  assert.deepEqual(festivalNight("2026-08-15", 45), {
    festivalDate: "2026-08-14",
    festivalStartMinute: 45 + 1440, // 00:45 → 24:45
  });
  // A normal evening start is untouched.
  assert.deepEqual(festivalNight("2026-08-15", 23 * 60), {
    festivalDate: "2026-08-15",
    festivalStartMinute: 23 * 60,
  });
});

test("eligibleSlots: a 00:30 show belongs to the night before, past 24:00, uncapped", () => {
  const s = eligibleSlots([show("late", "A", [{ date: "2026-08-15", start: "00:30" }])], {
    dateStart: "2026-08-14",
    dateEnd: "2026-08-14",
  }).get("late")[0];
  assert.equal(s.date, "2026-08-14", "re-dated to the festival night");
  assert.equal(s.realDate, "2026-08-15", "real date preserved for exports");
  assert.equal(s.startMinuteOfDay, 24 * 60 + 30); // 24:30
  assert.equal(s.endMinuteOfDay, 25 * 60 + 30); // 25:30 — not capped at 24:00
  // The morning-after date is NOT in a window that ends on the 14th's night.
  const none = eligibleSlots([show("late", "A", [{ date: "2026-08-15", start: "00:30" }])], {
    dateStart: "2026-08-15",
    dateEnd: "2026-08-15",
  }).get("late");
  assert.equal(none.length, 0);
});

test("eligibleSlots: an evening show keeps its true end past midnight", () => {
  const s = eligibleSlots(
    [show("owl", "A", [{ date: "2026-08-14", start: "23:30" }], { duration: 120 })],
    { dateStart: "2026-08-14", dateEnd: "2026-08-14" }
  ).get("owl")[0];
  assert.equal(s.startMinuteOfDay, 23 * 60 + 30);
  assert.equal(s.endMinuteOfDay, 25 * 60 + 30, "01:30 next day = 25:30, uncapped");
  // Placeable only when the day end reaches past it.
  assert.equal(withinDayWindow(s, { dayEndMin: 1440 }), false);
  assert.equal(withinDayWindow(s, { dayEndMin: 25 * 60 + 30 }), true);
});

// --- placement diagnostics ----------------------------------------------

test("placementDiagnostics: attributes blocked shows to the culpable control", () => {
  const shows = [
    // Only runs 08:30 — a 09:00 day-start shuts it out.
    show("early", "A", [{ date: "2026-08-14", start: "08:30" }]),
    // Only runs 23:30–00:30 — a 24:00 day-end shuts it out.
    show("late", "A", [{ date: "2026-08-14", start: "23:30" }]),
    // Only runs 12:45–13:45 — the lunch break shuts it out.
    show("noon", "A", [{ date: "2026-08-14", start: "12:45" }]),
    // Runs 15:00 — placeable, so never blamed.
    show("fine", "A", [{ date: "2026-08-14", start: "15:00" }]),
  ];
  const diag = placementDiagnostics(shows, {
    dateStart: "2026-08-14",
    dateEnd: "2026-08-14",
    dayStartMin: 9 * 60,
    dayEndMin: 24 * 60,
    mealBreaks: [{ id: "lunch", enabled: true, startMin: 12 * 60 + 30, endMin: 13 * 60 + 30 }],
  });
  assert.deepEqual(diag.dayStart.map((s) => s.slug), ["early"]);
  assert.deepEqual(diag.dayEnd.map((s) => s.slug), ["late"]);
  assert.deepEqual(diag.meals.lunch.map((s) => s.slug), ["noon"]);
  assert.equal(diag.blockedSlugs.has("fine"), false);
  assert.deepEqual([...diag.blockedSlugs].sort(), ["early", "late", "noon"]);
});
