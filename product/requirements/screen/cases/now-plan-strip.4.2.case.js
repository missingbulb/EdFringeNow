"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "spare-time prompt: 'You have … to spare — want to see a show? N fit below'",
  capture: ".plan-spare",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".plan-spare");
    await page.waitForTimeout(300);
  },
};
