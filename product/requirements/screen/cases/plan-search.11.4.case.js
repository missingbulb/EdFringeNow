"use strict";

module.exports = {
  description: "no matches: 'No shows match — try fewer filters or a different spelling.'",
  capture: "#ssPop",
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    await page.fill("#ssInput", "zzzzqqqxx");
    await page.waitForSelector("#ssEmpty:not([hidden])");
    await page.waitForTimeout(200);
  },
};
