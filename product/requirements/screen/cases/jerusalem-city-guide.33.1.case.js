"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The Jerusalem trip's city drawer, opened. */
module.exports = {
  description: "the city's drawer, opened: places to stay and eat near the venues, sights and day trips, each linked",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async ready(page) {
    await jerusalemReady(page);
    await page.waitForSelector('#cityGuide[data-state="shown"]', { state: "attached", timeout: 20000 });
  },
  async drive(page) {
    await page.click("#cityGuide > summary");
    await settle(page);
  },
  capture: "#cityGuide",
};
