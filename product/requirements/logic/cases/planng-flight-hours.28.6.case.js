"use strict";

// The rows ARE the requirement: the hours a flight takes on the trip's first
// and last day, on the festival's wall clock. verify() runs the shipped rule on
// flights given in London's zone and landing in Jerusalem's.
const TABLE = {
  columns: ["Flight", "Hours taken on the day"],
  rows: [
    ["Out, landing 14:30 local", "until 16:00: landing plus 90 minutes from the airport"],
    ["Out, landing after the day", "the whole day"],
    ["Out, landing the day before", "none"],
    ["Home, leaving 18:00 local", "from 15:30: 150 minutes for the airport"],
    ["Home, leaving the next morning", "none"],
    ["No flight", "none"],
  ],
};

const TZ = "Asia/Jerusalem";

module.exports = {
  description: "a flight's block runs to its landing plus the trip from the airport, or from its departure less the airport's time",
  table: TABLE,
  async verify(assert) {
    const { flightHours, NIGHT_END_MIN } = await import("../../../../site/planNG/lib/days.js");

    assert.deepEqual(
      flightHours("out", { departAt: "2026-10-17T07:40:00+01:00", durationMin: 290 }, "2026-10-17", TZ),
      { date: "2026-10-17", startMin: 0, endMin: 16 * 60 },
      "07:40 in London plus 4h50 lands 14:30 in Jerusalem; the day is free from 16:00"
    );
    assert.deepEqual(
      flightHours("out", { departAt: "2026-10-18T09:00:00+01:00", durationMin: 290 }, "2026-10-17", TZ),
      { date: "2026-10-17", startMin: 0, endMin: NIGHT_END_MIN },
      "landing the next day takes the whole first day"
    );
    assert.equal(
      flightHours("out", { departAt: "2026-10-16T07:40:00+01:00", durationMin: 290 }, "2026-10-17", TZ),
      null,
      "landing the day before takes nothing"
    );
    assert.deepEqual(
      flightHours("back", { departAt: "2026-10-23T18:00:00+03:00", durationMin: 300 }, "2026-10-23", TZ),
      { date: "2026-10-23", startMin: 15 * 60 + 30, endMin: NIGHT_END_MIN },
      "leaving at 18:00 takes the day from 15:30"
    );
    assert.equal(
      flightHours("back", { departAt: "2026-10-24T09:00:00+03:00", durationMin: 300 }, "2026-10-23", TZ),
      null,
      "leaving the next morning takes nothing from the last day"
    );
    assert.equal(flightHours("out", null, "2026-10-17", TZ), null, "no flight, no block");
  },
};
