"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "outside the UK the header carries the debug pill",
  capture: ".site-header",
  localStorage: nowStorage(),
  // Paris: a real fix, comfortably outside UK_BOUNDS.
  geolocation: { latitude: 48.8566, longitude: 2.3522 },
  // The app keeps its own simulated clock here (it adopts the device clock only
  // on an in-UK fix), so nowReady's reference-day wait would never pass.
  async ready(page) {
    await page.waitForSelector("#debugMenu:not([hidden])", { timeout: 20000 });
    await page.waitForFunction(() => {
      const b = document.getElementById("debugToggle");
      return b && b.textContent.includes("v0.0.0-spec");
    }, { timeout: 20000 });
    await settle(page);
  },
};
