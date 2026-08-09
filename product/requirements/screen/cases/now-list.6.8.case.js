"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "empty, with commitment: 'Nothing fits before your next commitment…'",
  capture: "#showsGrid .show-meta",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [], maxTravelMinutes: 1 }) },
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForTimeout(400);
  },
};
