"use strict";
const { planReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the search star adds a show to the grid and lifts it off again",
  page: "/plan/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.fill("#ssInput", "Masala");
    await page.waitForSelector(".ss-row");
    await page.click(".ss-row >> nth=0 >> .ss-star");
    await page.waitForSelector("#calWrap:not([hidden])");
    assert.equal(await page.locator(".lane").count(), 1, "starred show landed on the grid");
    // Search again (the picker cleared itself) and unstar.
    await page.fill("#ssInput", "Masala");
    await page.waitForSelector(".ss-row.is-on");
    await page.click(".ss-row.is-on >> .ss-star");
    await page.waitForSelector("#intakeStage .dropzone");
    assert.ok(await page.locator("#calWrap").isHidden(), "last removal returns to the intake");
  },
};
