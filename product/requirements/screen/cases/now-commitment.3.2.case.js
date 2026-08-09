"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "open constraint panel: wheels preset to 21:30, live count, pick list, place input",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500); // wheel sync runs on the next frame
  },
};
