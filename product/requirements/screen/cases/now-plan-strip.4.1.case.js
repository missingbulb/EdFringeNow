"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "committed show renders the plan: header + Open in Maps, origin node, leg, destination node",
  capture: "#journeyStrip",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.waitForTimeout(300);
  },
};
