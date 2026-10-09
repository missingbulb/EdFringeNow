import { test } from "node:test";
import assert from "node:assert/strict";
import { ARRIVALS, arrivalOf } from "../arrival.js";

test("an origin that says how it arrives is read as it says", () => {
  for (const arrive of ARRIVALS) assert.equal(arrivalOf({ kind: "country", country: "IL", arrive }), arrive);
});

test("an origin saved before the question is read by where it placed the reader", () => {
  assert.equal(arrivalOf({ kind: "city", country: "IL" }), "local");
  assert.equal(arrivalOf({ kind: "abroad" }), "fly");
  assert.equal(arrivalOf({ kind: "country", country: "IL" }), null);
  assert.equal(arrivalOf({ kind: "skipped" }), null);
  assert.equal(arrivalOf(null), null);
});
