"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "the clock moves on by itself",
  localStorage: nowStorage(),
  // Time still stands still, but the page's timers can be wound forward.
  advanceableClock: true,
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.waitForTimeout(300);
  },
  async capture(page, t) {
    const origin = () => t.element("#journeyStrip .plan-node.you");
    const before = await origin();
    await page.clock.fastForward(60_000); // the turn of the minute
    await page.waitForTimeout(400);
    return t.animate([before, await origin()]);
  },
};
