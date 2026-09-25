"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* "Use my location" with the harness's fixed position in central Edinburgh:
 * the point the device gave is kept as the answer. */
module.exports = {
  description: "\"use my location\" answers the question from the device's position",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    await page.click('.flight--out [data-origin="ask"]');
    await page.click('#originCard [data-origin="position"]');
    await page.waitForSelector("#originCard", { state: "hidden", timeout: 10000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.origin")));
    assert.equal(stored.kind, "position", "the device's position is the answer");
    assert.ok(Math.abs(stored.lat - 55.95) < 0.1 && Math.abs(stored.lng + 3.19) < 0.1, "the position the device gave");
  },
};
