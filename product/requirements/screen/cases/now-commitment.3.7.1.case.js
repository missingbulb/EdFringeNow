"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "the wheel's minutes step by five",
  capture: "#minWheel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
  },
};
