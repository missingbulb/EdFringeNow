"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "no Plan button: editing the day-end box re-plans instantly",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector(".sch-show");
    const before = await page.locator(".sch-show").count();
    const summaryBefore = await page.textContent("#planSummary");
    // A 13:00 day end shuts every evening show out — instantly.
    await page.fill("#ctlDayEnd", "13:00");
    await page.keyboard.press("Tab"); // blur fires the change natively
    await page.waitForTimeout(600);
    const after = await page.locator(".sch-show").count();
    assert.ok(after < before, `fewer scheduled blocks (${before} → ${after})`);
    assert.notEqual(await page.textContent("#planSummary"), summaryBefore, "summary re-written");
  },
};
