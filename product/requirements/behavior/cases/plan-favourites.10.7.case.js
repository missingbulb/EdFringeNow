"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "Clear two-step confirm: arms with the count, disarms on Escape, clears on the second click",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    await page.click("#clearFavBtn");
    assert.match((await page.textContent("#clearFavBtn")).trim(), /^Clear all 9 shows\? Click again$/);
    // Escape disarms.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    assert.match((await page.textContent("#clearFavBtn")).trim(), /Clear$/);
    // Arm again and confirm: back to the intake.
    await page.click("#clearFavBtn");
    await page.click("#clearFavBtn");
    await page.waitForSelector("#intakeStage .dropzone");
    assert.ok(await page.locator("#calWrap").isHidden(), "grid gone");
    assert.equal(
      await page.evaluate(() => localStorage.getItem("edfringe.plan.favourites.v1")),
      null,
      "stored list cleared"
    );
  },
};
