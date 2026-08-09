"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "committed show renders the plan: header + Open in Maps, origin node, leg, destination node",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.waitForTimeout(300);
  },
};
