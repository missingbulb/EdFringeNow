"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "committed route on the map: legs, arrowheads, the green ✓ deadline pill, dimmed pins",
  capture: "#map",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForTimeout(300);
    await page.click('.view-btn[data-mode="map"]');
    await page.waitForSelector(".leaflet-tile-loaded");
    await page.waitForTimeout(600);
  },
};
