"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  // Reference now is 19:30, so the wheel must open on 21:30.
  description: "the wheel opens at now + 2 hours",
  capture: ".wheel-time",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400);
  },
};
