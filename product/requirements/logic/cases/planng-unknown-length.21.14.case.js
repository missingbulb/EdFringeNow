"use strict";

// The rows ARE the requirement: what a show with no published length is
// allowed near the day's end and the reader's own blocks.
const TABLE = {
  columns: ["A show with no length, starting", "Day ends 20:30", "Dinner 21:00–22:00"],
  rows: [
    ["19:30", "drafted: an hour ends at 20:30", "drafted"],
    ["20:00", "not drafted: an hour runs past 20:30", "drafted: it ends as dinner starts"],
    ["20:30", "not drafted", "not drafted: it runs into dinner"],
  ],
};

const show = (id, start) => ({
  slug: `acco/${id}`,
  title: id,
  venue: "v",
  duration: null,
  performances: [{ date: "2026-09-29", start, status: "AVAILABLE" }],
});

module.exports = {
  description: "a show with no published length counts as an hour against the day's end and the reader's blocks",
  table: TABLE,
  async verify(assert) {
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");
    const { ASSUMED_LENGTH_MIN, slotRule } = await import("../../../../site/planNG/lib/days.js");
    assert.equal(ASSUMED_LENGTH_MIN, 60, "an hour");
    const base = {
      dateStart: "2026-09-29",
      dateEnd: "2026-09-29",
      windowStart: "2026-09-29T00:00",
      windowEnd: "2026-09-29T23:59",
      assumedLengthMin: ASSUMED_LENGTH_MIN,
    };
    const drafted = (start, opts) =>
      draftCalendar([show("x", start)], { ...base, ...opts }).days.flatMap((d) => d.slots).length === 1;

    assert.equal(drafted("19:30", { dayEndMin: 20 * 60 + 30 }), true, "19:30 plus an hour fits a 20:30 end");
    assert.equal(drafted("20:00", { dayEndMin: 20 * 60 + 30 }), false, "20:00 plus an hour does not");
    const dinner = slotRule(new Map(), new Map([["2026-09-29", [{ startMin: 21 * 60, endMin: 22 * 60 }]]]));
    assert.equal(drafted("20:30", { dayEndMin: 20 * 60 + 30 }), false, "nor does 20:30");
    const withDinner = (start) => drafted(start, { dayEndMin: 25 * 60, allowSlot: dinner });
    assert.equal(withDinner("19:30"), true, "well before dinner");
    assert.equal(withDinner("20:00"), true, "ending as dinner starts is fine");
    assert.equal(withDinner("20:30"), false, "running into dinner is not");
  },
};
