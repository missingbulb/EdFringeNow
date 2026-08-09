"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "clicking a mark locks that exact performance (gold + 🔒); clicking it again unlocks",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    const seg = page.locator('.seg[data-date="2026-08-15"][data-start="19:45"]');
    await seg.click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator(".seg--pinned").count() > 0, "the mark is pinned gold");
    assert.ok(await page.locator(".lane--forced").count() > 0, "its lane wears the padlock");
    await page.locator(".seg--pinned").click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".seg--pinned").count(), 0, "second click unpins");
  },
};
