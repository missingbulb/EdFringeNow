"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "Search tools: six facet chips; genre panel open with counts and everything!",
  async capture(page, t) {
    return t.stitchV([await t.element("#ssTools"), await t.element("#ssfGenrePanel")]);
  },
  page: "/plan/",
  viewport: "desktop",
  // A populated board sits behind the floating panel (as in real use) — on an
  // empty page the site footer would bleed through the crop.
  localStorage: planFavourites(),
  async drive(page) {
    await page.click("#ssToolsBtn");
    await page.waitForSelector("#ssTools:not([hidden])");
    await page.click('[data-panel="ssfGenrePanel"]');
    await page.waitForSelector("#ssfGenreOptions label");
    await page.waitForTimeout(200);
  },
};
