import { test } from "node:test";
import assert from "node:assert/strict";

import { holidaysIn, homeCountry } from "../holidays.js";

test("the country the reader said wins over the connection's", () => {
  assert.deepEqual(homeCountry({ kind: "abroad", country: "GB" }, "IL"), { country: "GB", guessed: false });
  assert.deepEqual(homeCountry({ kind: "city", country: "IL", city: "jerusalem" }, "GB"), { country: "IL", guessed: false });
});

test("an answer that names no country leaves the guess standing", () => {
  for (const origin of [null, { kind: "skipped" }, { kind: "position", lat: 1, lng: 2 }, { kind: "abroad" }]) {
    assert.deepEqual(homeCountry(origin, "FR"), { country: "FR", guessed: true }, JSON.stringify(origin));
  }
  assert.equal(homeCountry(null, null), null, "no answer and no guess: no holidays");
});

test("only the strip's days, named in the page's language or else in English", () => {
  const doc = {
    holidays: [
      { date: "2026-06-30", name: { en: "Before" } },
      { date: "2026-07-01", name: { en: "First", he: "ראשון" } },
      { date: "2027-06-30", name: { en: "Last" } },
      { date: "2027-07-01", name: { en: "After" } },
    ],
  };
  assert.deepEqual(holidaysIn(doc, { from: "2026-07-01", to: "2027-06-30" }, "he"), [
    { date: "2026-07-01", name: "ראשון" },
    { date: "2027-06-30", name: "Last" },
  ]);
});
