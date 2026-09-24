"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* "Use my location" with the harness's fixed position in central Edinburgh:
 * the point is kept, and judged against Jerusalem it is abroad. */
module.exports = {
  description: "\"use my location\" answers the question from the device's position",
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    await page.click('#originCard [data-origin="position"]');
    await page.waitForSelector("#originCard", { state: "hidden", timeout: 10000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.origin")));
    assert.equal(stored.kind, "position", "the device's position is the answer");
    assert.ok(Math.abs(stored.lat - 55.95) < 0.1 && Math.abs(stored.lng + 3.19) < 0.1, "the position the device gave");
    assert.deepEqual(
      await page.$$eval("#tripLinksRow .trip-link-text", (els) => els.map((e) => e.dataset.i18nSlot)),
      ["trip.stay", "trip.transfers", "trip.rail"],
      "Edinburgh is abroad for Jerusalem: the airport is offered"
    );
    assert.equal(await page.isVisible("#originLine"), true, "and the trip links say where from");
  },
};
