"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the Legend popup: the grid's seven-entry colour vocabulary, verbatim",
  page: "/plan/",
  viewport: "desktop",
  // A floating popup: a full-page capture scrolls (which dismisses it) — the
  // viewport crop is the honest frame.
  viewportOnly: true,
  localStorage: planFavourites(),
  async drive(page) {
    await page.click("#legendBtn");
    await page.waitForSelector("#calLegend:not([hidden])");
    await page.waitForTimeout(200);
  },
};
