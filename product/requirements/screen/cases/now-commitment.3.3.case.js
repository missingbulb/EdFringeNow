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
    // The picked minute is read back through the wheel's own debounce, so the
    // empty pick list — the state this leaf is about — is what says the new
    // time has actually been applied.
    await page.waitForSelector(".picklist-empty");
    await settle(page);
  },
};
