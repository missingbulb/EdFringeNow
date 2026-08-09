"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "tapping a pin selects that show",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click('.view-btn[data-mode="map"]');
    await page.waitForSelector(".leaflet-tile-loaded");
    await page.waitForTimeout(600);
  },
  async capture(page, t) {
    const before = await t.element("#map");
    await page.click(".genre-pin >> nth=0");
    await page.waitForTimeout(500);
    return t.animate([before, await t.element("#map")]);
  },
};
