"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "committed list heading: 'N shows you can slip in before 21:30', cards say fits",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".si-fits");
    await page.waitForTimeout(300);
  },
};
