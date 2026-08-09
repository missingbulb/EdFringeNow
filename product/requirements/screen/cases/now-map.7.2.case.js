"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "committed route on the map: legs, arrowheads, the green ✓ deadline pill, dimmed pins",
  capture: "#map",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click(".cta-trigger");
    // Wait for the panel's pick list to actually be built, not for a guessed
    // number of milliseconds: the wheels sync on a later frame, and on a slow
    // runner a fixed 400ms landed before the list existed.
    await page.waitForSelector("#constraintPanel:not([hidden]) .show-pick");
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForTimeout(300);
    await page.click('.view-btn[data-mode="map"]');
    await page.waitForSelector(".leaflet-tile-loaded");
    await page.waitForTimeout(600);
  },
};
