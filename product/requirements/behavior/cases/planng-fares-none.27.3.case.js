"use strict";
const { jerusalemReady, routeFares, flightsSettled } = require("../../shared/case-helpers");

/* No fare to show — the service not there at all, or the partner finding
 * nothing — leaves each block with the partner's search for its own day and
 * route, and no price anywhere. */
module.exports = {
  description: "with no fare to show, a flight block offers the partner's search for that day and route instead of a price",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    // The harness serves no /api/fares at all: the service is not there.
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.selectOption("#originCountry", "GB");
    await flightsSettled(page);
    assert.equal(await page.locator(".flight-price").count(), 0, "nothing claims a price");
    assert.equal(await page.getAttribute(".flight--out .flight-search", "href"), "https://www.aviasales.com/search/LON1710TLV1");
    assert.equal(await page.getAttribute(".flight--back .flight-search", "href"), "https://www.aviasales.com/search/TLV2310LON1");

    // The service there, the partner finding nothing for Madrid.
    await routeFares(page);
    await page.fill("#flightFrom", "MAD");
    await page.dispatchEvent("#flightFrom", "change");
    await flightsSettled(page);
    assert.equal(await page.getAttribute(".flight--out", "data-fares"), "none", "the service answered, with nothing");
    assert.equal(await page.locator(".flight-price").count(), 0, "still nothing claims a price");
    assert.equal(await page.getAttribute(".flight--out .flight-search", "href"), "https://www.aviasales.com/search/MAD1710TLV1");
    assert.equal(await page.getAttribute(".flight--back .flight-search", "href"), "https://www.aviasales.com/search/TLV2310MAD1");
  },
};
