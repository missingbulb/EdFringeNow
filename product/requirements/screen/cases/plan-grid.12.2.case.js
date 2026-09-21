"use strict";
const { planFavourites, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the Legend popup: the grid's seven-entry colour vocabulary, verbatim",
  capture: "#calLegend",
  page: "/plan/",
  viewport: "desktop",
  // A floating popup: a full-page capture scrolls (which dismisses it) — the
  // viewport crop is the honest frame.
  viewportOnly: true,
  localStorage: planFavourites(),
  async drive(page) {
    await page.click("#legendBtn");
    await page.waitForSelector("#calLegend:not([hidden])");
    await settle(page);
  },
};
