"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "empty, with commitment: 'Nothing fits before your next commitment…'",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [], maxTravelMinutes: 1 }) },
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForTimeout(400);
  },
};
