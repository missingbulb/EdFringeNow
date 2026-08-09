"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "open constraint panel: wheels preset to 21:30, live count, pick list, place input",
  capture: "#constraintPanel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame // wheel sync runs on the next frame
  },
};
