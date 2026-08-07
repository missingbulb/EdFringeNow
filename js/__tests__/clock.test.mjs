// Node tests for the Now page's clock helpers (js/clock.js) — the pure part of
// the real-clock ticker. Plain node:test + node:assert, no DOM. Run from the
// repo root with:
//   node --test js/__tests__/clock.test.mjs
//
// The timezone cases pass an explicit `timeZone` so they assert the same thing
// wherever the suite runs; the default-zone case only checks the shape, since
// the runner's own zone is whatever CI happens to have.

import test from "node:test";
import assert from "node:assert/strict";

import {
  FESTIVAL_TZ,
  festivalDate,
  festivalNow,
  msToNextMinute,
  timeZoneLabel,
} from "../clock.js";

test("msToNextMinute counts to the next turn of the minute", () => {
  // 12:00:20.000 -> 40s to go.
  assert.equal(msToNextMinute(new Date(2026, 7, 14, 12, 0, 20, 0)), 40000);
  // Sub-second precision counts too: 12:00:20.250 -> 39.75s.
  assert.equal(msToNextMinute(new Date(2026, 7, 14, 12, 0, 20, 250)), 39750);
  // Last instant of the minute -> 1 ms.
  assert.equal(msToNextMinute(new Date(2026, 7, 14, 12, 0, 59, 999)), 1);
});

test("msToNextMinute never returns zero, so the ticker can't spin", () => {
  // Exactly on the minute is a whole minute from the NEXT boundary, not 0 —
  // a 0 ms re-arm would fire again immediately and re-render in a loop.
  assert.equal(msToNextMinute(new Date(2026, 7, 14, 12, 0, 0, 0)), 60000);
});

test("timeZoneLabel names the UK zone on each side of the DST boundary", () => {
  // Mid-August: British Summer Time. Mid-January: GMT.
  assert.equal(timeZoneLabel(new Date("2026-08-14T14:44:00Z"), "Europe/London"), "BST");
  assert.equal(timeZoneLabel(new Date("2026-01-14T15:44:00Z"), "Europe/London"), "GMT");
});

test("timeZoneLabel returns a string for the runner's own zone", () => {
  // No `timeZone` argument = the device's zone, which is what the app uses.
  const label = timeZoneLabel(new Date("2026-08-14T14:44:00Z"));
  assert.equal(typeof label, "string");
});

test("timeZoneLabel returns an empty string rather than throwing", () => {
  // An unusable zone must not take the clock down with it — the caller keeps
  // whatever label it was already showing.
  assert.equal(timeZoneLabel(new Date("2026-08-14T14:44:00Z"), "Not/AZone"), "");
});

// festivalNow / festivalDate: the app's clock is Edinburgh's, not the device's.
// Show times come out of the scraper as Edinburgh wall-clock, so "now" has to
// be read the same way or every on-now / can-I-get-there comparison is out by
// the visitor's offset. These pass instants (a "Z" literal) so the assertions
// hold whatever zone the suite runs in.

test("festivalNow reads an instant as Edinburgh wall-clock", () => {
  // 14:44Z in August is 15:44 BST — the app's own pre-set time.
  const at = festivalNow(new Date("2026-08-14T14:44:00Z"));
  assert.equal(at.date, "2026-08-14");
  assert.equal(at.time, "15:44");
  assert.equal(at.minutes, 15 * 60 + 44);
  assert.deepEqual([at.year, at.month, at.day, at.hour, at.minute],
                   [2026, 8, 14, 15, 44]);
});

test("festivalNow ignores the device's zone", () => {
  // The same instant read from Tokyo or Los Angeles is still 15:44 in
  // Edinburgh — this is the whole reason the helper exists.
  const instant = new Date("2026-08-14T14:44:00Z");
  assert.equal(festivalNow(instant, "Asia/Tokyo").time, "23:44");
  assert.equal(festivalNow(instant, FESTIVAL_TZ).time, "15:44");
});

test("festivalNow rolls the date over on Edinburgh's midnight, not UTC's", () => {
  // 23:30Z on the 9th is already 00:30 on the 10th at the venue — which is the
  // date whose day file a late-night show is listed in.
  const at = festivalNow(new Date("2026-08-09T23:30:00Z"));
  assert.equal(at.date, "2026-08-10");
  assert.equal(at.time, "00:30");
  assert.equal(at.minutes, 30);
});

test("festivalNow pads to a fixed width and uses a 24-hour clock", () => {
  // "09:05", never "9:5"; and midnight is "00:00", not "24:00" — NOW.time is
  // rendered straight into the header and compared as a string elsewhere.
  assert.equal(festivalNow(new Date("2026-08-05T08:05:00Z")).time, "09:05");
  assert.equal(festivalNow(new Date("2026-08-09T23:00:00Z")).time, "00:00");
  assert.equal(festivalNow(new Date("2026-08-09T23:00:00Z")).minutes, 0);
});

test("festivalNow falls back to the device clock rather than throwing", () => {
  // A stripped ICU (or an ancient browser) must not take the clock down: the
  // reading degrades to the device's own, which is right in the UK anyway.
  const at = festivalNow(new Date(2026, 7, 14, 15, 44), "Not/AZone");
  assert.equal(at.time, "15:44");
  assert.equal(at.date, "2026-08-14");
});

test("festivalDate resolves an Edinburgh wall-clock reading to an instant", () => {
  // The inverse of festivalNow: 15:44 in Edinburgh in August is 14:44Z.
  assert.equal(festivalDate("2026-08-14T15:44").toISOString(),
               "2026-08-14T14:44:00.000Z");
  // Outside BST the offset is zero and the reading is the instant.
  assert.equal(festivalDate("2026-01-14T15:44").toISOString(),
               "2026-01-14T15:44:00.000Z");
});

test("festivalDate round-trips through festivalNow", () => {
  // What the debug picker does on every change: show a reading, take it back.
  for (const local of ["2026-08-14T15:44", "2026-08-10T00:30", "2026-08-31T23:55",
                       "2026-03-29T02:30", "2026-10-25T01:30"]) {
    const at = festivalNow(festivalDate(local));
    assert.equal(`${at.date}T${at.time}`, local, local);
  }
});

test("festivalDate returns an Invalid Date for junk", () => {
  // The picker's caller tests isNaN and keeps the clock it had.
  assert.ok(isNaN(festivalDate("").getTime()));
  assert.ok(isNaN(festivalDate("not a time").getTime()));
});
