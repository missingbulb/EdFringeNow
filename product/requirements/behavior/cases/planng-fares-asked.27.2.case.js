"use strict";
const { jerusalemReady, routeFares, flightsSettled } = require("../../shared/case-helpers");

/* The fares are asked for the trip's own days and route, once each way, and
 * again for the one day that moved; a fare links to its own page on the
 * partner's site. */
module.exports = {
  description: "fares are asked for the trip's days and route when they are set, and a flight links to that fare on the partner's site",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const asked = await routeFares(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(asked.length, 0, "nothing is asked before the reader says they are flying");

    await page.selectOption("#originCountry", "GB");
    await flightsSettled(page);
    const q = (p) => [p.get("from"), p.get("to"), p.get("date"), p.get("currency")];
    assert.deepEqual(
      asked.map(q),
      [
        ["LON", "TLV", "2026-10-17", "gbp"],
        ["TLV", "LON", "2026-10-23", "gbp"],
      ],
      "London to Ben Gurion on the trip's first day, and back on its last, in pounds"
    );
    assert.equal(
      await page.getAttribute(".flight--out .flight-fare", "href"),
      "https://www.aviasales.com/search/LON1710TLV1?t=LY17606769001776066300000290LHRTLV_d4e5f6&search_date=24092026&expected_price_uuid=00000000-0000-0000-0000-000000000002&expected_price_source=share&expected_price_currency=gbp",
      "the cheapest fare out links to its own page"
    );

    await page.fill("#tripTo", "2026-10-24");
    await page.waitForFunction(() => document.querySelector(".flight--back .flight-day")?.textContent.includes("24"));
    await flightsSettled(page);
    assert.deepEqual(asked.slice(2).map(q), [["TLV", "LON", "2026-10-24", "gbp"]], "a moved last day asks again for that day only");

    await page.fill("#flightFrom", "par");
    await page.dispatchEvent("#flightFrom", "change");
    await flightsSettled(page);
    assert.deepEqual(
      asked.slice(3).map((p) => [p.get("from"), p.get("to")]),
      [
        ["PAR", "TLV"],
        ["TLV", "PAR"],
      ],
      "a typed airport asks again both ways"
    );
  },
};
