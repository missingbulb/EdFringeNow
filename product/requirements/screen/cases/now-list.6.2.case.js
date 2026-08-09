"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "committed list heading: 'N shows you can slip in before 21:30', cards say fits",
  async capture(page, t) {
    return t.stitchV([await t.element("#showsTitle"), await t.element(".show-item")]);
  },
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".si-fits");
    await page.waitForTimeout(300);
  },
};
