"use strict";
const { festival } = require("../../shared/fixtures/registry");

module.exports = {
  description: "the bed link: Booking.com's Hebrew edition, Jerusalem, shekels, the nights it is handed",
  async verify(assert) {
    const { tripLinks } = await import("../../../../site/planNG/festivals.js");
    const [stay] = tripLinks(festival("jerusalem-comedy"), "abroad", "2026-10-17", "2026-10-23");

    // Asserted as a URL, never followed — the partner is a real booking site.
    assert.equal(stay.labelKey, "trip.stay");
    const url = new URL(stay.url);
    assert.equal(url.host, "www.booking.com");
    assert.equal(url.pathname, "/searchresults.he.html", "the Hebrew edition lives at its own path");
    assert.equal(url.searchParams.get("ss"), "Jerusalem");
    assert.equal(url.searchParams.get("selected_currency"), "ILS");
    assert.equal(url.searchParams.get("checkin"), "2026-10-17");
    assert.equal(url.searchParams.get("checkout"), "2026-10-23");

    // The nights are whatever the caller hands it, not the festival's run.
    const [narrowed] = tripLinks(festival("jerusalem-comedy"), "abroad", "2026-10-18", "2026-10-23");
    assert.equal(new URL(narrowed.url).searchParams.get("checkin"), "2026-10-18");
  },
};
