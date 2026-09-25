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

test("a break runs over the weekend and a lone work day between days off", async () => {
  const { holidayBreaks } = await import("../holidays.js");
  const span = { from: "2026-01-01", to: "2026-12-31" };
  const doc = (dates, weekend) => ({ weekend, holidays: dates.map((date) => ({ date, name: { en: `H${date.slice(8)}` } })) });
  // Wed 7 + Thu 8 Oct, Fri 9 a work day, Sat 10 + Sun 11 the weekend.
  assert.deepEqual(holidayBreaks(doc(["2026-10-07", "2026-10-08"]), span, "en"), [
    { from: "2026-10-07", to: "2026-10-11", days: 5, workdays: 1, weekend: true, names: ["H07", "H08"] },
  ]);
  // A Tuesday alone: Sat-Sun, Mon bridged, Tue.
  assert.equal(holidayBreaks(doc(["2026-10-13"]), span, "en")[0].from, "2026-10-10");
  // A Wednesday alone stands alone: two work days either side.
  assert.deepEqual(holidayBreaks(doc(["2026-10-14"]), span, "en")[0], { from: "2026-10-14", to: "2026-10-14", days: 1, workdays: 0, weekend: false, names: ["H14"] });
  // The country's own weekend: a Thursday runs into Friday-Saturday.
  assert.equal(holidayBreaks(doc(["2026-10-15"], ["fri", "sat"]), span, "en")[0].to, "2026-10-17");
  // A break outside the span is dropped.
  assert.deepEqual(holidayBreaks(doc(["2027-10-14"]), span, "en"), []);
});

test("a holiday moved off the weekend is named once in its break", async () => {
  const { holidayBreaks } = await import("../holidays.js");
  const doc = {
    holidays: [
      { date: "2026-12-25", name: { en: "Christmas Day" } },
      { date: "2026-12-26", name: { en: "Boxing Day" } },
      { date: "2026-12-28", name: { en: "Boxing Day (observed)" } },
    ],
  };
  assert.deepEqual(holidayBreaks(doc, { from: "2026-01-01", to: "2026-12-31" }, "en")[0].names, ["Christmas Day", "Boxing Day"]);
});
