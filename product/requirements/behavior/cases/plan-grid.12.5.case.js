"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "clicking the show's name pins the whole show; other marks wear the dashed outline",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    await page.click('.lane-title:has-text("Ray Bradshaw")');
    await page.waitForTimeout(400);
    assert.ok(await page.locator(".lane--forced").count() > 0, "lane pinned");
    assert.ok(await page.locator(".seg--forced-all").count() > 0, "unchosen marks dashed gold");
    await page.click('.lane-title:has-text("Ray Bradshaw")');
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".lane--forced").count(), 0, "second click unpins the show");
  },
};
