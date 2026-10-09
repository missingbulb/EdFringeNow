"use strict";

// The rows ARE the requirement: which day a first draft keeps. verify() runs
// the shipped rule over small trips built so each row's answer can only come
// from the rule it names.
const TABLE = {
  columns: ["The trip", "The day kept"],
  rows: [
    ["Reaches a festival nearby", "that festival's, on the day it plays most"],
    ["Reaches none", "rest, on the day with fewest shows playing only that night"],
    ["Two days tie", "the earlier"],
    ["The first or last day", "never"],
    ["Fewer than three days", "none"],
  ],
};

const slot = (date) => ({ date });
const DATES = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];

module.exports = {
  description: "a first draft keeps one day for a festival nearby, else for rest on the day that costs least",
  table: TABLE,
  async verify(assert) {
    const { seedDay } = await import("../../../../site/planNG/lib/days.js");

    assert.deepEqual(
      seedDay({
        dates: DATES,
        lead: "haifa-iff",
        slots: new Map([
          ["haifa-iff/a", [slot("2026-10-02"), slot("2026-10-03")]],
          ["acco/b", [slot("2026-10-03"), slot("2026-10-04")]],
          ["acco/c", [slot("2026-10-04")]],
        ]),
      }),
      { date: "2026-10-04", kind: "festival", festival: "acco" },
      "the nearby festival's fullest day"
    );
    assert.deepEqual(
      seedDay({
        dates: DATES,
        lead: "jerusalem-comedy",
        slots: new Map([
          ["jerusalem-comedy/a", [slot("2026-10-02")]],
          ["jerusalem-comedy/b", [slot("2026-10-03"), slot("2026-10-04")]],
          ["jerusalem-comedy/c", [slot("2026-10-04")]],
        ]),
      }),
      { date: "2026-10-03", kind: "rest" },
      "rest on the day with fewest shows playing only then"
    );
    assert.deepEqual(
      seedDay({
        dates: DATES,
        lead: "jerusalem-comedy",
        slots: new Map([["jerusalem-comedy/a", [slot("2026-10-02"), slot("2026-10-03"), slot("2026-10-04")]]]),
      }),
      { date: "2026-10-02", kind: "rest" },
      "a tie goes to the earlier day"
    );
    assert.deepEqual(
      seedDay({
        dates: DATES,
        lead: "jerusalem-comedy",
        slots: new Map([
          ["jerusalem-comedy/a", [slot("2026-10-01"), slot("2026-10-05")]],
          ["jerusalem-comedy/b", [slot("2026-10-03")]],
        ]),
      }),
      { date: "2026-10-03", kind: "rest" },
      "the first and last days are never kept, however cheap"
    );
    assert.equal(
      seedDay({ dates: DATES.slice(0, 2), lead: "x", slots: new Map([["x/a", [slot("2026-10-01")]]]) }),
      null,
      "a two-day trip keeps no day"
    );
  },
};
