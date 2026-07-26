// Tests for the refresh-tickets precondition window (task.mjs) — the August /
// 08:00–23:00-Edinburgh gate that replaced the retired workflow's sixteen
// hand-spelled cron lines.
//
// This is the load-bearing part of that port: the scheduler's slot math is UTC
// and Edinburgh is BST (UTC+1) through the whole of August, so reading the UTC
// hour as if it were local would shift the festival window an hour early and
// drop the last hour of every day. Two things are asserted:
//
//  1. the window's verdict at a spread of instants — mid-August in-window and
//     out-of-window, the boundary hours, and non-August months;
//  2. that the fixed +1h shift agrees with the real Europe/London zone (via
//     Intl) at every one of those instants — so the "August is always BST"
//     reasoning is checked against the timezone database, not just asserted.

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
  ["2026-08-15T11:49:00Z", true, "mid-August mid-afternoon — squarely in the window"],
  ["2026-08-15T07:49:00Z", true, "07:49 UTC = 08:49 BST — the FIRST in-window hour, and the case a UTC-as-local reading would wrongly reject"],
  ["2026-08-15T22:49:00Z", true, "22:49 UTC = 23:49 BST — the LAST in-window hour, which a UTC-as-local reading would wrongly reject"],
  ["2026-08-15T06:49:00Z", false, "07:49 BST — the hour below the window"],
  ["2026-08-15T23:49:00Z", false, "00:49 BST the next morning — past the window"],
  ["2026-08-15T02:49:00Z", false, "03:49 BST — the dead of the night, no box office"],
  ["2026-08-31T22:49:00Z", true, "23:49 BST on the last day of August — the final firing of the festival"],
  ["2026-08-31T23:49:00Z", false, "00:49 BST on 1 September — the festival is over"],
  ["2026-07-31T22:49:00Z", false, "23:49 BST on 31 July — still July, however close"],
  ["2026-07-31T23:49:00Z", false, "00:49 BST on 1 August — August locally, but hour 0 is out of window"],
  ["2026-07-15T11:49:00Z", false, "mid-July — outside the festival month"],
  ["2026-09-15T11:49:00Z", false, "mid-September — outside the festival month"],
  ["2026-01-15T11:49:00Z", false, "mid-January (GMT, not BST) — outside the festival month"],
];

test("the refresh-tickets window fires exactly on August 08:00–23:59 Edinburgh", () => {
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

test("the sixteen retired cron hours all land in the window, and no others do", () => {
  // The retired workflow fired at UTC hours 7..22 on August days. Every one of
  // those hours must still fire; every other UTC hour must not.
  const fired = [];
  for (let utcHour = 0; utcHour < 24; utcHour += 1) {
    const instant = `2026-08-15T${String(utcHour).padStart(2, "0")}:49:00Z`;
    if (ticketWindow(instant).run) fired.push(utcHour);
  }
  assert.deepEqual(fired, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  assert.equal(fired.length, 16, "one firing per retired cron line");
});
