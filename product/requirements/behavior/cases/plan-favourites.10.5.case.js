"use strict";
const { planReady, planFavourites, uploadFile, PLAN_FAVOURITES } = require("../../shared/case-helpers");

module.exports = {
  description: "a failed upload leaves the existing grid and stored list untouched",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    const lanes = await page.locator(".lane").count();
    // The board is populated; drop a stale-year export on it. (The summary
    // panel lives inside the intake, which stays hidden while a grid is up —
    // the visible contract is exactly "nothing changed".)
    await uploadFile(
      page,
      "old.csv",
      "Title,URL\r\nGone,https://www.edfringe.com/tickets/whats-on/not-this-year\r\n"
    );
    await page.waitForTimeout(600);
    assert.ok(await page.locator("#calWrap").isVisible(), "grid still up");
    assert.equal(await page.locator(".lane").count(), lanes, "grid unchanged");
    const stored = JSON.parse(
      await page.evaluate(() => localStorage.getItem("edfringe.plan.favourites.v1"))
    );
    assert.equal(stored.slugs.length, PLAN_FAVOURITES.length, "stored list unchanged");
  },
};
