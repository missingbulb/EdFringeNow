"use strict";

module.exports = {
  description: "travel is straight-line at honest August speeds: walk 3.33 km/h, bike 15, car 22",
  async verify(assert) {
    const { TRAVEL_SPEED_KMH, distanceKm, travelMinutes, DEFAULT_TRAVEL_MODE } = await import(
      "../../../../plan/lib/travel.js"
    );
    assert.ok(Math.abs(TRAVEL_SPEED_KMH.walk - 10 / 3) < 1e-9);
    assert.equal(TRAVEL_SPEED_KMH.bike, 15);
    assert.equal(TRAVEL_SPEED_KMH.car, 22);
    assert.equal(DEFAULT_TRAVEL_MODE, "walk");

    // A known pair: Fringe Central → Castle Esplanade ≈ 1.1 km crow-flies.
    const a = { lat: 55.948084, lng: -3.185279 };
    const b = { lat: 55.9486, lng: -3.2041 };
    const km = distanceKm(a, b);
    assert.ok(km > 1.1 && km < 1.25, `distance ${km}`);
    // Minutes scale inversely with speed.
    const walk = travelMinutes(a, b, "walk");
    const bike = travelMinutes(a, b, "bike");
    assert.ok(Math.abs(walk / bike - 15 / (10 / 3)) < 0.01);
    // Unknown coordinates → null, never a guess.
    assert.equal(travelMinutes({ lat: null, lng: null }, b, "walk"), null);
  },
};
