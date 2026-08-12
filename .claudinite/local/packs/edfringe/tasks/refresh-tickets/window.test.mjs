// Tests for the refresh-tickets precondition gate (task.mjs): August, read on
// the Edinburgh clock. The instants where UTC and Edinburgh disagree about the
// month — the last hours of 31 July and 31 August — are the cases that matter,
// and the fixed +1h shift is cross-checked against the real Europe/London zone
// (via Intl) so the "August is always BST" reasoning is verified, not asserted.

import { test } from "node:test";
import assert from "node:assert/strict";

import { edinburghClock, ticketWindow } from "./task.mjs";

// The real Europe/London wall clock at an instant, straight from the ICU tz data.
const zoned = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  month: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});
function realEdinburghClock(instant) {
  const parts = Object.fromEntries(zoned.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return { month: Number(parts.month), hour: Number(parts.hour) };
}

// [instant (UTC), should the task run, what the case proves]
const CASES = [
  ["2026-08-15T11:49:00Z", true, "mid-August"],
  ["2026-08-15T02:49:00Z", true, "any hour of an August day passes — an hours gate here would silence the task"],
  ["2026-08-01T04:00:00Z", true, "the first day of the festival"],
  ["2026-08-31T04:00:00Z", true, "the last day of the festival"],
  ["2026-08-31T23:49:00Z", false, "00:49 BST on 1 September — over locally, though UTC still says August"],
  ["2026-07-31T22:49:00Z", false, "23:49 BST on 31 July — still July, however close"],
  ["2026-07-31T23:49:00Z", true, "00:49 BST on 1 August — August locally, though UTC still says July"],
  ["2026-07-15T11:49:00Z", false, "mid-July"],
  ["2026-09-15T11:49:00Z", false, "mid-September"],
  ["2026-01-15T11:49:00Z", false, "mid-January (GMT, not BST)"],
];

test("the refresh-tickets gate fires on August, read on the Edinburgh clock", () => {
  for (const [instant, expected, why] of CASES) {
    const verdict = ticketWindow(instant);
    assert.equal(verdict.run, expected, `${instant} (${why}) — reason was: ${verdict.reason}`);
    assert.ok(verdict.reason.length > 0, `${instant} must carry a reason`);
  }
});

test("the fixed +1h shift matches the real Europe/London clock across the window", () => {
  for (const [instant, , why] of CASES) {
    const real = realEdinburghClock(instant);
    const ours = edinburghClock(instant);
    // Outside BST the fixed shift is deliberately wrong by an hour — the month
    // test rejects those instants anyway, so only the August cases must agree.
    if (real.month !== 8 && ours.month !== 8) continue;
    assert.deepEqual(ours, real, `${instant} (${why}) — Europe/London says ${JSON.stringify(real)}`);
  }
});
