"use strict";
const { nowStorage, settle, wheelsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "a minute with no starts: 'No shows start exactly then. Nearest:' + suggestions",
  async capture(page, t) {
    return t.unionClip([".timepick-count", ".picklist-empty", ".timepick-suggest"]);
  },
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await wheelsSettled(page);
    // Nudge the minute wheel from 21:30 to 21:35 — nothing starts then.
    await page.focus("#minWheel");
    await page.keyboard.press("ArrowDown");
    await settle(page);
    await page.waitForSelector(".timepick-suggest, .picklist-empty");
  },
};
