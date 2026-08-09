"use strict";
const { nowReady } = require("../../shared/case-helpers");

// The same page-top region three times — the explainer shown, gone after the
// dismissal, and still gone after a reload — played as one animation, so the
// requirement reads as the flow it is.
const REGION = { x: 0, y: 0, width: 390, height: 560 };

module.exports = {
  description: "dismissing the explainer hides it, and a reload keeps it hidden",
  // No storage seed: a first-time visitor is the state this leaf starts from.
  async capture(page, t) {
    const shown = await t.clip(REGION);
    await page.click("#introGot");
    await page.waitForSelector("#intro", { state: "hidden" });
    await page.waitForTimeout(150);
    const dismissed = await t.clip(REGION);
    await page.reload({ waitUntil: "load" });
    await nowReady(page);
    const afterReload = await t.clip(REGION);
    return t.animate([shown, dismissed, afterReload]);
  },
};
