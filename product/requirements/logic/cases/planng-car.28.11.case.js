"use strict";

// The rows ARE the requirement: what having a car changes.
const TABLE = {
  columns: ["Getting here", "Between airport and town", "A car?", "Suggested between shows", "A day trip reaches"],
  rows: [
    ["Driving your own car", "—", "yes", "driving", "250 km"],
    ["Flying", "hire car", "yes", "driving", "250 km"],
    ["Flying", "taxi or transfer", "no", "no change", "160 km"],
    ["Flying", "train", "no", "no change", "160 km"],
    ["Flying", "not said", "no", "no change", "160 km"],
    ["By train", "—", "no", "no change", "160 km"],
    ["Living there", "—", "no", "no change", "160 km"],
  ],
};

const ARRIVE = { "Driving your own car": "drive", Flying: "fly", "By train": "train", "Living there": "local" };
const GROUND = { "hire car": "car", "taxi or transfer": "taxi", train: "train", "not said": null, "—": null };

module.exports = {
  description: "a car suggests driving between shows and widens a day trip to 250 km",
  table: TABLE,
  async verify(assert) {
    const { hasCar } = await import("../../../../site/planNG/lib/arrival.js");
    const { dayTripKm, travelDays } = await import("../../../../site/shared/feasibility.js");
    for (const [how, ground, car, mode, reach] of TABLE.rows) {
      const has = hasCar(ARRIVE[how], GROUND[ground]);
      assert.equal(has, car === "yes", `${how} / ${ground}: a car?`);
      assert.equal(dayTripKm(has), Number.parseInt(reach, 10), `${how} / ${ground}: day-trip reach`);
      assert.equal(mode === "driving", has, `${how} / ${ground}: suggests driving`);
    }
    // The reach is what the pool judges by: 200 km is a day trip with a car only.
    assert.equal(travelDays(200, dayTripKm(true)), 0);
    assert.equal(travelDays(200, dayTripKm(false)), 1);
  },
};
