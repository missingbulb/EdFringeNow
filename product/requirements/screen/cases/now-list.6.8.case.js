"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "empty, with commitment: 'Nothing fits before your next commitment…'",
  capture: "#showsGrid .show-meta",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [], maxTravelMinutes: 1 }) },
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    // The wheels are positioned a frame after the panel is shown, and the
    // settle handler reads them back 130 ms later. Wait for the picker to be
    // resting on its default time rather than sleeping past it: a fixed sleep
    // can't tell "settled" from "settled on the wrong hour", and the wrong hour
    // is sticky — nothing re-renders the list — so the failure used to surface
    // 30 s later as a selector timeout instead of here, where it happened.
    await page.waitForFunction(() => {
      const lab = document.getElementById("constraintCountLab");
      return lab && lab.textContent.includes("21:30");
    });
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForTimeout(400);
  },
};
