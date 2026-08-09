"use strict";

// Two Edinburgh venues about 1 km apart (≈18 min at walking speed).
const A = { venueCode: "1", venueLat: 55.9486, venueLng: -3.1881 };
const B = { venueCode: "2", venueLat: 55.9486, venueLng: -3.2041 };

module.exports = {
  description: "gap between shows = max(chosen gap, travel time); same venue 0; unknown coords → flat gap",
  async verify(assert) {
    const { requiredGapMinutes, compatible } = await import("../../../../plan/lib/engine.js");
    const opts = { minGapSameVenue: 0, minGapDifferentVenue: 30, travelMode: "walk" };

    // Same venue: a double bill needs no travel.
    assert.equal(requiredGapMinutes({ ...A }, { ...A }, opts), 0);
    // Different venues, walk ≈ 18 min < 30-min floor → the floor holds.
    assert.equal(requiredGapMinutes({ ...A }, { ...B }, opts), 30);
    // Travel only ADDS time when it exceeds the gap: with a 5-min floor the
    // 18-min walk wins.
    const walked = requiredGapMinutes({ ...A }, { ...B }, { ...opts, minGapDifferentVenue: 5 });
    assert.ok(walked >= 17 && walked <= 19, `walked gap ${walked}`);
    // Unknown coordinates fall back to the flat gap.
    assert.equal(
      requiredGapMinutes({ venueCode: "3", venueLat: null, venueLng: null }, { ...B }, opts),
      30
    );

    // compatible() applies that gap between the earlier end and the later start.
    const a = { ...A, start: 1000, end: 1060 };
    const b = { ...B, start: 1090, end: 1150 };
    assert.ok(compatible(a, b, opts)); // exactly 30 apart
    assert.ok(!compatible(a, { ...b, start: 1089 }, opts));
  },
};
