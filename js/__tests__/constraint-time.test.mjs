// Node tests for the "next commitment" time wheel's arithmetic
// (js/constraint-time.js). Plain node:test + node:assert, no DOM. Run from the
// repo root with:
//   node --test js/__tests__/constraint-time.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  WHEEL_MINUTES,
  defaultConstraintTime,
  earliestWheelMinutes,
  minutesForHour,
  wheelHours,
} from "../constraint-time.js";

const at = (h, m) => h * 60 + m;

test("the wheel starts at the next five-minute slot from now", () => {
  assert.equal(earliestWheelMinutes(at(14, 31)), at(14, 35));
  // Already on the grid: now itself is still offerable.
  assert.equal(earliestWheelMinutes(at(14, 35)), at(14, 35));
});

test("the wheel's first hour is the current hour, not the first show's", () => {
  const hours = wheelHours(at(14, 31));
  assert.equal(hours[0], "14");
  assert.equal(hours.at(-1), "23");
  assert.equal(hours.length, 10);
});

test("the current hour only offers minutes still ahead", () => {
  // 14:31 -> the 14 wheel starts at :35; every later hour is untouched.
  assert.deepEqual(minutesForHour("14", at(14, 31)), ["35", "40", "45", "50", "55"]);
  assert.deepEqual(minutesForHour("15", at(14, 31)), WHEEL_MINUTES);
  assert.deepEqual(minutesForHour("23", at(14, 31)), WHEEL_MINUTES);
});

test("an hour with no slots left isn't offered at all", () => {
  // 14:56 rounds up into the 15 o'clock hour, so the wheel starts there.
  assert.equal(wheelHours(at(14, 56))[0], "15");
  assert.deepEqual(minutesForHour("15", at(14, 56)), WHEEL_MINUTES);
});

test("the wheel opens two hours out, on the five-minute grid", () => {
  assert.equal(defaultConstraintTime(at(14, 31)), "16:30");
  assert.equal(defaultConstraintTime(at(9, 0)), "11:00");
  assert.equal(defaultConstraintTime(at(10, 3)), "12:05");
});

test("late in the day the default clamps to the last slot, never past midnight", () => {
  assert.equal(defaultConstraintTime(at(22, 30)), "23:55");
  assert.equal(defaultConstraintTime(at(23, 50)), "23:55");
  // ...and the wheel still has that one slot to offer.
  assert.equal(earliestWheelMinutes(at(23, 58)), at(23, 55));
  assert.deepEqual(wheelHours(at(23, 58)), ["23"]);
  assert.deepEqual(minutesForHour("23", at(23, 58)), ["55"]);
});

test("the default is never a time already gone", () => {
  for (let m = 0; m < 24 * 60; m += 7) {
    const [h, mm] = defaultConstraintTime(m).split(":").map(Number);
    assert.ok(h * 60 + mm >= earliestWheelMinutes(m), `default too early at ${m}`);
  }
});
