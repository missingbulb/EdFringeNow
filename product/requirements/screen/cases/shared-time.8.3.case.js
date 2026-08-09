"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the page's clock can be driven from the debug tools",
  localStorage: nowStorage(),
  // The tools only exist outside the UK, where the app keeps its own clock.
  geolocation: { latitude: 48.8566, longitude: 2.3522 },
  async ready(page) {
    await page.waitForSelector("#debugMenu:not([hidden])", { timeout: 20000 });
    await settle(page);
  },
  async capture(page, t) {
    await page.click("#debugToggle");
    await page.waitForSelector("#debugPop:not([hidden])");
    await page.waitForTimeout(200);
    return t.element("#debugPop");
  },
};
