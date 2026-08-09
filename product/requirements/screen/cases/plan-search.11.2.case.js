"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "result rows: star, title, price·genre·venue·time; capped foot 'Showing 30 of N matches'",
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
