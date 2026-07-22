// Node test for the pure CSV/ICS exporters. No dependencies — plain
// node:test + node:assert. Run from /workspace/edfringenow with:
//   node plan/lib/__tests__/itinerary.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSchedule } from "../engine.js";
import { toCsv, toIcs, slotEndTime } from "../itinerary.js";

// One synthetic show with a comma in its title (to exercise CSV quoting) and a
// known duration so start/end are predictable.
const SHOWS = [
  {
    slug: "hello-goodbye",
    title: "Hello, Goodbye",
    genre: "Comedy",
    duration: 60,
    venue: "V1",
    venueName: "Venue One",
    room: "Studio",
    performances: [
      { date: "2026-08-10", start: "19:30", soldOut: false, status: "TICKETS_AVAILABLE" },
    ],
  },
];

const schedule = buildSchedule(SHOWS, {
  windowStart: "2026-08-10T00:00",
  windowEnd: "2026-08-10T23:59",
});

test("buildSchedule produced exactly the one slot with derived end time", () => {
  assert.equal(schedule.scheduled.length, 1);
  const slot = schedule.scheduled[0];
  assert.equal(slot.startTime, "19:30");
  assert.equal(slotEndTime(slot), "20:30"); // 19:30 + 60min duration
});

test("toCsv: header + one quoted row with the right columns", () => {
  const csv = toCsv(schedule.scheduled);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Date,Day,Start,End,Show,Genre,Venue,Room,Status,Tickets");
  // Title has a comma → must be quoted; Mon 10 Aug 2026.
  assert.ok(lines[1].startsWith("2026-08-10,Mon,19:30,20:30,"), lines[1]);
  assert.ok(lines[1].includes('"Hello, Goodbye"'), "comma title should be quoted");
  assert.ok(lines[1].includes("Comedy"));
  assert.ok(lines[1].includes("Venue One"));
});

test("toCsv: empty schedule yields just the header", () => {
  assert.equal(toCsv([]), "Date,Day,Start,End,Show,Genre,Venue,Room,Status,Tickets");
});

test("toIcs: well-formed VCALENDAR with one floating-time VEVENT", () => {
  const ics = toIcs(schedule.scheduled, { now: new Date(Date.UTC(2026, 6, 22, 12, 0, 0)) });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, 1);
  // Floating local time (no trailing Z) at the Edinburgh wall clock.
  assert.ok(ics.includes("DTSTART:20260810T193000"), ics);
  assert.ok(ics.includes("DTEND:20260810T203000"), ics);
  // DTSTAMP is the UTC export instant we passed in.
  assert.ok(ics.includes("DTSTAMP:20260722T120000Z"), ics);
  // Comma / other specials in SUMMARY are backslash-escaped per RFC-5545.
  assert.ok(ics.includes("SUMMARY:Hello\\, Goodbye"), ics);
});

test("toIcs: UID is stable for the same slot across two exports", () => {
  const a = toIcs(schedule.scheduled, { now: new Date(Date.UTC(2026, 6, 22)) });
  const b = toIcs(schedule.scheduled, { now: new Date(Date.UTC(2026, 6, 23)) });
  const uidA = a.match(/UID:(.+)/)[1];
  const uidB = b.match(/UID:(.+)/)[1];
  assert.equal(uidA, uidB); // UID must not depend on export time
  assert.match(uidA, /^hello-goodbye-20260810T193000@edfringenow\.com/);
});
