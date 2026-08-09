"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "arrow keys move a window handle a day; flags and ARIA values follow",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    assert.equal((await page.textContent("#flagStart")).trim(), "7 Aug");
    await page.focus("#hStart");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700); // the keyboard nudge glides
    assert.equal((await page.textContent("#flagStart")).trim(), "8 Aug");
    assert.equal(await page.getAttribute("#hStart", "aria-valuenow"), "8");
    assert.equal(await page.getAttribute("#hStart", "aria-valuetext"), "8 August");
    assert.equal((await page.textContent("#railLen")).trim(), "17 days");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(700);
    assert.equal((await page.textContent("#flagStart")).trim(), "7 Aug");
  },
};
