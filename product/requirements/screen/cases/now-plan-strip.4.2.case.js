"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "spare-time prompt: 'You have … to spare — want to see a show? N fit below'",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".plan-spare");
    await page.waitForTimeout(300);
  },
};
