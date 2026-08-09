"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "a minute with no starts: 'No shows start exactly then. Nearest:' + suggestions",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    // Nudge the minute wheel from 21:30 to 21:35 — nothing starts then.
    await page.focus("#minWheel");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(600); // wheel settles, value read ~130ms after scroll stops
    await page.waitForSelector(".timepick-suggest, .picklist-empty");
  },
};
