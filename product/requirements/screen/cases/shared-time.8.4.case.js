"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the clock moves on by itself",
  localStorage: nowStorage(),
  // Time still stands still, but the page's timers can be wound forward.
  advanceableClock: true,
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await settle(page);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await settle(page);
  },
  async capture(page, t) {
    const origin = () => t.element("#journeyStrip .plan-node.you");
    const before = await origin();
    await page.clock.fastForward(60_000); // the turn of the minute
    await settle(page);
    return t.animate([before, await origin()]);
  },
};
