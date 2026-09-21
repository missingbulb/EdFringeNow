"use strict";
const { nowStorage, nowSettings, settle, tilesSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "tapping a pin selects that show",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click('.view-btn[data-mode="map"]');
    await tilesSettled(page);
  },
  async capture(page, t) {
    const before = await t.element("#map");
    await page.click(".genre-pin >> nth=0");
    await settle(page);
    return t.animate([before, await t.element("#map")]);
  },
};
