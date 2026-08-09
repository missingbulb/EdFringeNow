"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the row's × removes the show; removing the last returns to the intake",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(["ray-bradshaw-five-years-in-a-row", "borderlandscomedy"]),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    assert.equal(await page.locator(".lane").count(), 2);
    await page.click(".lane >> nth=0 >> .lane-remove");
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".lane").count(), 1, "row removed");
    await page.click(".lane >> nth=0 >> .lane-remove");
    await page.waitForSelector("#intakeStage .dropzone");
    assert.ok(await page.locator("#calWrap").isHidden(), "empty board is the intake again");
  },
};
