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
import { FRINGE_DAY_END_MINUTES, FRINGE_DAY_START_MINUTES } from "../../shared/fringe-day.js";

const at = (h, m) => h * 60 + m;

test("the wheel starts at the next five-minute slot from now", () => {
  assert.equal(earliestWheelMinutes(at(14, 31)), at(14, 35));
  // Already on the grid: now itself is still offerable.
  assert.equal(earliestWheelMinutes(at(14, 35)), at(14, 35));
});

test("the wheel's first hour is the current hour, not the first show's", () => {
  const hours = wheelHours(at(14, 31));
  assert.equal(hours[0], "14");
  // ...and it runs to the end of the FRINGE day, not the calendar one: 29 is
  // 05:00 tomorrow, the last hour a late show can start in.
  assert.equal(hours.at(-1), "29");
  assert.equal(hours.length, 16);
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

test("the evening rolls through midnight rather than stopping at it", () => {
  // The point of the whole change: at 23:50 the wheel's next offer is a show
  // after midnight, not nothing at all.
  assert.equal(defaultConstraintTime(at(22, 30)), "24:30");
  assert.equal(defaultConstraintTime(at(23, 50)), "25:50");
  assert.deepEqual(wheelHours(at(23, 58)), ["24", "25", "26", "27", "28", "29"]);
  assert.deepEqual(minutesForHour("24", at(23, 58)), WHEEL_MINUTES);
});

test("past midnight the wheel keeps counting up, not round", () => {
  // 00:30 is 24:30 of the fringe day that started yesterday morning.
  const nowMin = 24 * 60 + 30;
  assert.equal(earliestWheelMinutes(nowMin), nowMin);
  assert.equal(wheelHours(nowMin)[0], "24");
  assert.equal(defaultConstraintTime(nowMin), "26:30");
});

test("the fringe day ends at 06:00, and the last slot is 05:55", () => {
  assert.equal(defaultConstraintTime(at(28, 30)), "29:55");
  assert.equal(defaultConstraintTime(at(29, 50)), "29:55");
  // ...and the wheel still has that one slot to offer.
  assert.equal(earliestWheelMinutes(at(29, 58)), at(29, 55));
  assert.deepEqual(wheelHours(at(29, 58)), ["29"]);
  assert.deepEqual(minutesForHour("29", at(29, 58)), ["55"]);
});

test("the default is never a time already gone", () => {
  for (let m = FRINGE_DAY_START_MINUTES; m < FRINGE_DAY_END_MINUTES; m += 7) {
    const [h, mm] = defaultConstraintTime(m).split(":").map(Number);
    assert.ok(h * 60 + mm >= earliestWheelMinutes(m), `default too early at ${m}`);
  }
});
