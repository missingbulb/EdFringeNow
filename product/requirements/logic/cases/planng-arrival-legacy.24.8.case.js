"use strict";

// The rows ARE the requirement: what an answer saved before the page asked
// how the reader travels is read as. verify() feeds each stored shape to the
// shipped reader.
const TABLE = {
  columns: ["Saved answer", "Read as"],
  rows: [
    ["I live in the festival's city", "living there"],
    ["Coming from a country abroad", "flying"],
    ["Somewhere else abroad", "flying"],
    ["Elsewhere in the country", "not yet said"],
    ["The device's position", "not yet said"],
    ["Not now", "not yet said"],
  ],
};

const SAVED = [
  { kind: "city", city: "jerusalem", country: "IL", lat: 31.78, lng: 35.22 },
  { kind: "abroad", country: "GB" },
  { kind: "abroad" },
  { kind: "country", country: "IL" },
  { kind: "position", lat: 55.95, lng: -3.19 },
  { kind: "skipped" },
];
const READ = { "living there": "local", flying: "fly", "not yet said": null };

module.exports = {
  description: "an answer saved before the page asked how you travel is read as one",
  table: TABLE,
  async verify(assert) {
    const { arrivalOf } = await import("../../../../site/planNG/lib/arrival.js");
    assert.equal(SAVED.length, TABLE.rows.length);
    TABLE.rows.forEach(([said, read], i) => assert.equal(arrivalOf(SAVED[i]), READ[read], said));
    assert.equal(arrivalOf(null), null, "nothing saved is not yet said");
    for (const arrive of ["local", "drive", "train", "fly"]) {
      assert.equal(arrivalOf({ kind: "country", country: "IL", arrive }), arrive, `an answer that says ${arrive} is read as it says`);
    }
    assert.equal(arrivalOf({ kind: "abroad", country: "GB", arrive: "boat" }), "fly", "an unknown way falls back to the saved place");
  },
};
