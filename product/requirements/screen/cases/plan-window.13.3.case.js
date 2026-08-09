"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the optimizer popup: day count, 'Include the most weekends' checked, Find best dates",
  page: "/plan/",
  viewport: "desktop",
  // A floating popup: a full-page capture scrolls (which dismisses it) — the
  // viewport crop is the honest frame.
  viewportOnly: true,
  localStorage: planFavourites(),
  async drive(page) {
    await page.click("#railOptBtn");
    await page.waitForSelector("#railPop:not([hidden])");
    await page.waitForTimeout(200);
  },
};
