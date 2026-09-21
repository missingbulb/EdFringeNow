"use strict";
const { nowStorage, settle, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "picking a show closes the picker and swaps the intake card for the plan",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
  },
  // Before: the open picker inside the intake card. After: the plan, with the
  // intake gone and the panel closed.
  async capture(page, t) {
    // The panel is positioned over the card, so the region is their union;
    // after the pick the same region holds the collapsed card and the plan.
    const picker = await t.unionClip([".cta-card", "#constraintPanel"]);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await settle(page);
    return t.animate([picker, await t.unionClip([".cta-card", "#journeyStrip"])]);
  },
};
