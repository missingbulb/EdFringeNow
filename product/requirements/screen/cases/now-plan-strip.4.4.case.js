"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "a selected show that breaks the commitment wears the You'll-be-late chip",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    // Select the 20:55 show first, then commit to 21:30 — it can't fit.
    while (await page.locator("#showMore").isVisible()) await page.click("#showMore");
    await page.click('.show-item:has-text("The Inverted Realm")');
    await page.waitForSelector(".show-item--leg");
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector(".plan-slack.wontfit");
    await page.waitForTimeout(300);
  },
};
