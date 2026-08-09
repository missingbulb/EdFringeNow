"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "geocoder unreachable: 'Map search isn't reachable right now.'",
  localStorage: nowStorage(),
  failData: ["nominatim"],
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.fill("#destInput", "waverley");
    await page.click("#destFind");
    await page.waitForSelector(".place-msg");
    await page.waitForTimeout(200);
  },
};
