"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "picking a show closes the picker and swaps the intake card for the plan",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
  },
  // Before: the open picker inside the intake card. After: the plan, with the
  // intake gone and the panel closed.
  async capture(page, t) {
    // The panel is positioned over the card, so the region is their union;
    // after the pick the same region holds the collapsed card and the plan.
    const picker = await t.unionClip([".cta-card", "#constraintPanel"]);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.waitForTimeout(200);
    return t.animate([picker, await t.unionClip([".cta-card", "#journeyStrip"])]);
  },
};
