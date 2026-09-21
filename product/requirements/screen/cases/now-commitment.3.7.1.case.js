"use strict";
const { nowStorage, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "the wheel's minutes step by five",
  capture: "#minWheel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
  },
};
