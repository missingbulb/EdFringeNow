"use strict";
const { festival } = require("../../shared/fixtures/registry");

/* Each answer to "where are you coming from?", judged against a festival's
 * city, and the trip links it leaves: none from the festival's own city, a bed
 * and a train from elsewhere in the country, the airport too from abroad. */
module.exports = {
  description: "the answer decides the trip links",
  async verify(assert) {
    const { originReach } = await import("../../../../site/shared/feasibility.js");
    const { tripLinks } = await import("../../../../site/planNG/festivals.js");
    const offered = (origin, fest) =>
      tripLinks(fest, originReach(origin, fest), "2026-10-17", "2026-10-23").map((l) => l.labelKey);

    const jerusalem = festival("jerusalem-comedy");
    const city = { kind: "city", city: jerusalem.city, country: jerusalem.country, lat: jerusalem.lat, lng: jerusalem.lng };
    assert.deepEqual(offered(city, jerusalem), [], "the festival's own city: nothing to book");
    assert.deepEqual(offered({ kind: "country", country: "IL" }, jerusalem), ["trip.stay", "trip.rail"], "elsewhere in the country: a bed and a train");
    assert.deepEqual(
      offered({ kind: "abroad", country: "FR" }, jerusalem),
      ["trip.stay", "trip.transfers", "trip.rail"],
      "abroad: a bed, the airport and the train"
    );
    assert.deepEqual(
      offered({ kind: "abroad", country: "FR" }, festival("haifa-iff")),
      ["trip.stay", "trip.transfers", "trip.rail"],
      "and the same answer is judged for another festival's own city"
    );
  },
};
