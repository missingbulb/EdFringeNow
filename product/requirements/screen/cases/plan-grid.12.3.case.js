"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "day-mark hover card: title, meta, date, per-performance status rows, pin hint",
  page: "/plan/",
  viewport: "desktop",
  // A floating popup: a full-page capture scrolls (which dismisses it) — the
  // viewport crop is the honest frame.
  viewportOnly: true,
  localStorage: planFavourites(),
  async drive(page) {
    await page.hover('.seg[data-date="2026-08-15"][data-start="19:45"]');
    await page.waitForSelector("#calTip:not([hidden])");
    await page.waitForTimeout(250);
  },
};
