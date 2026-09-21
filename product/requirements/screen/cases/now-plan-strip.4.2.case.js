"use strict";
const { nowStorage, settle, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "spare-time prompt: 'You have … to spare — want to see a show? N fit below'",
  capture: ".plan-spare",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".plan-spare");
    await settle(page);
  },
};
