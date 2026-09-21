"use strict";
const { nowStorage, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "open constraint panel: wheels preset to 21:30, live count, pick list, place input",
  capture: "#constraintPanel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
  },
};
