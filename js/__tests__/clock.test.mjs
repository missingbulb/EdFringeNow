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

import { msToNextMinute, timeZoneLabel } from "../clock.js";

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
