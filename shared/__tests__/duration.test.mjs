// Node test for the shared friendly-duration formatter. No dependencies —
// plain node:test + node:assert. Run from the repo root with:
//   node --test shared/__tests__/duration.test.mjs
//
// The formatter exists because "You have 287 min to spare" is unreadable, so
// what matters here is the *band boundaries* — where the phrasing changes — and
// that the "about" band rounds to the nearest half hour rather than truncating.
// Each assertion below was checked against a deliberately broken implementation
// before being trusted (band edges moved, Math.round swapped for Math.floor).

import { test } from "node:test";
import assert from "node:assert/strict";

import { friendlyDuration } from "../duration.js";

test("under an hour reads as exact minutes", () => {
  assert.equal(friendlyDuration(1), "1 minute");
  assert.equal(friendlyDuration(45), "45 minutes");
  assert.equal(friendlyDuration(59), "59 minutes");
});

test("a whole number of hours drops the minutes", () => {
  assert.equal(friendlyDuration(60), "1 hour");
  assert.equal(friendlyDuration(120), "2 hours");
});

test("one to two hours reads as hours and minutes", () => {
  assert.equal(friendlyDuration(61), "1 hour and 1 minute");
  assert.equal(friendlyDuration(80), "1 hour and 20 minutes");
  assert.equal(friendlyDuration(119), "1 hour and 59 minutes");
});

test("past two hours rounds to the nearest half hour, and says so", () => {
  // Just over the boundary still rounds down to a flat "2 hours" — the point of
  // the band is that the minutes stop mattering, not that they accumulate.
  assert.equal(friendlyDuration(121), "about 2 hours");
  assert.equal(friendlyDuration(135), "about 2½ hours");
  assert.equal(friendlyDuration(150), "about 2½ hours");
  assert.equal(friendlyDuration(164), "about 2½ hours");
  assert.equal(friendlyDuration(166), "about 3 hours");
  // The number that prompted all this: 287 minutes is 4h47m, and the nearest
  // half hour to that is five o'clock, not half four.
  assert.equal(friendlyDuration(287), "about 5 hours");
});

test("fractional minutes are rounded before formatting", () => {
  assert.equal(friendlyDuration(44.6), "45 minutes");
  assert.equal(friendlyDuration(59.7), "1 hour");
});

test("nothing to format returns an empty string", () => {
  // The caller expresses a deficit itself ("20 min late") and passes the
  // absolute value, so a negative here is a bug, not a phrasing case.
  assert.equal(friendlyDuration(-5), "");
  assert.equal(friendlyDuration(NaN), "");
  assert.equal(friendlyDuration(Infinity), "");
  assert.equal(friendlyDuration(undefined), "");
});

test("zero is still a duration", () => {
  assert.equal(friendlyDuration(0), "0 minutes");
});
