"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "map view: user dot, reach circle, emoji pins, cluster bubbles over faked tiles",
  capture: "#map",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click('.view-btn[data-mode="map"]');
    await page.waitForSelector(".leaflet-tile-loaded");
    await page.waitForTimeout(600);
  },
};
