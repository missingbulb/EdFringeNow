"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "conflict tip: 'Every performance of this show runs during your lunch break (12:30–13:30)…'",
  capture: "#calTip",
  page: "/plan/",
  viewport: "desktop",
  // A floating popup: a full-page capture scrolls (which dismisses it) — the
  // viewport crop is the honest frame.
  viewportOnly: true,
  localStorage: planFavourites(),
  async drive(page) {
    await page.hover('.lane-status button:has-text("Lunch conflict")');
    await page.waitForSelector("#calTip:not([hidden])");
    await page.waitForTimeout(250);
  },
};
