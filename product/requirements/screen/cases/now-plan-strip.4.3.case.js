"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "slipped-in show: stop node with time range, slack chip, and the buy-ahead link",
  capture: "#journeyStrip .plan-node.stop",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForSelector(".plan-node.stop .plan-slack");
    await page.waitForTimeout(300);
  },
};
