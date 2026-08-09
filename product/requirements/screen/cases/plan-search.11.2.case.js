"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "result rows: star, title, price·genre·venue·time; capped foot 'Showing 30 of N matches'",
  async capture(page, t) {
    const rows = [];
    for (let i = 0; i < 3; i++) rows.push(await page.locator(".ss-row").nth(i).boundingBox());
    return t.stitchV([await t.clip(t.pad(t.union(rows))), await t.element("#ssFoot")]);
  },
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async drive(page) {
    await page.fill("#ssInput", "a");
    await page.waitForSelector(".ss-row");
    await page.waitForSelector("#ssFoot:not([hidden])");
    await page.waitForTimeout(200);
  },
};
