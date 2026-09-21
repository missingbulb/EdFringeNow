"use strict";
const { nowStorage, settle, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "committed list heading: 'N shows you can slip in before 21:30', cards say fits",
  async capture(page, t) {
    return t.stitchV([await t.element("#showsTitle"), await t.element(".show-item")]);
  },
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".si-fits");
    await settle(page);
  },
};
