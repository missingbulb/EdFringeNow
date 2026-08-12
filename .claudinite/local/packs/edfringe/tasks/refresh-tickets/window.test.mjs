// Tests for the refresh-tickets precondition gate (task.mjs) — the August gate
// that decides whether the day's one refresh slot acts.
//
// The gate used to carry an 08:00–23:59-Edinburgh hours window too, standing in
// for the sixteen hand-written cron lines of the hourly workflow this task
// replaced. The cadence is now once a day (`daily+1h` → 05:00 UTC), so the hours
// window went with it: a once-a-day slot has one evaluation to spend and an
// hours gate could only reject it. The first test below pins that — the slot's
// own hour must not be a reason to skip.
//
// What still has to be right is the LOCAL month. The scheduler's slot math is
// UTC and Edinburgh is BST (UTC+1) through the whole of August, so the two
// instants where the two calendars disagree — 23:xx UTC on 31 July and on 31
// August — must be read on the Edinburgh clock. Two things are asserted:
//
//  1. the gate's verdict at a spread of instants, including both month edges;
//  2. that the fixed +1h shift agrees with the real Europe/London zone (via
//     Intl) at every one of those instants — so the "August is always BST"
//     reasoning is checked against the timezone database, not just asserted.

import { test } from "node:test";
import assert from "node:assert/strict";

import declaration, { edinburghClock, ticketWindow } from "./task.mjs";

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
  ["2026-08-15T04:00:00Z", true, "the real daily+1h slot mid-festival — 05:00 BST, the hour the task actually evaluates at"],
  ["2026-08-15T11:49:00Z", true, "mid-August mid-afternoon"],
  ["2026-08-15T02:49:00Z", true, "03:49 BST — the dead of the night, which the retired hours window rejected and the daily gate does not"],
  ["2026-08-15T23:49:00Z", true, "00:49 BST on 16 August — still the festival, however odd the hour"],
  ["2026-08-01T04:00:00Z", true, "the slot on the first day of the festival"],
  ["2026-08-31T04:00:00Z", true, "the slot on the last day of the festival — the final refresh of the run"],
  ["2026-08-31T23:49:00Z", false, "00:49 BST on 1 September — the festival is over, and UTC still says August"],
  ["2026-07-31T22:49:00Z", false, "23:49 BST on 31 July — still July, however close"],
  ["2026-07-31T23:49:00Z", true, "00:49 BST on 1 August — August locally though UTC says July; the hours window used to reject this and the month alone does not"],
  ["2026-07-15T11:49:00Z", false, "mid-July — outside the festival month"],
  ["2026-09-15T11:49:00Z", false, "mid-September — outside the festival month"],
  ["2026-01-15T11:49:00Z", false, "mid-January (GMT, not BST) — outside the festival month"],
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

test("no hour of the day is a reason to skip, so the daily slot can never be gated out", () => {
  // The failure this pins is silent and total: leave an hours window on a
  // once-a-day task and the slot lands outside it, the precondition says no
  // every single day, and the refresh simply never runs again — with the task
  // still declared, still evaluated, and reporting no error at all.
  const skipped = [];
  for (let utcHour = 0; utcHour < 24; utcHour += 1) {
    const instant = `2026-08-15T${String(utcHour).padStart(2, "0")}:00:00Z`;
    if (!ticketWindow(instant).run) skipped.push(utcHour);
  }
  assert.deepEqual(skipped, [], "every hour of an August day must pass the gate");
});

test("the declared cadence is daily, and an hour clear of the refresh-shows anchor", () => {
  // `daily+1h` is load-bearing twice: it is what makes this once-a-day rather
  // than sixteen-times-a-day, and the +1h keeps it out of the anchor slot
  // refresh-shows holds, so the repo's two data-committing tasks never share a
  // checkout. Both are easy to undo by "tidying" this back to plain `daily`.
  assert.equal(declaration.frequency, "daily+1h");
});
