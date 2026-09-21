"use strict";
const { nowStorage, nowSettings, revealWholeList, settle, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "a selected show that breaks the commitment wears the You'll-be-late chip",
  capture: "#journeyStrip .plan-node.stop",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    // Select the 20:55 show first, then commit to 21:30 — it can't fit.
    await revealWholeList(page);
    await page.click('.show-item:has-text("The Inverted Realm")');
    await page.waitForSelector(".show-item--leg");
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".plan-slack.wontfit");
    await settle(page);
  },
};
