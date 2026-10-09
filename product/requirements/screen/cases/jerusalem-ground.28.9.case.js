"use strict";
const { jerusalemReady, routeFares, flightsSettled, settle, answerTravel } = require("../../shared/case-helpers");

/* Coming from London: the first day's flight block, opened. */
module.exports = {
  description: "a flight's block asks how you get between the airport and town, each way with where to book it",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  viewportOnly: true,
  ready: jerusalemReady,
  async drive(page) {
    await routeFares(page);
    await answerTravel(page, { home: "GB", way: "fly" });
    await flightsSettled(page);
    await page.waitForFunction(() => document.querySelectorAll(".sch-own--flight").length === 2, null, { timeout: 20000 });
    await jerusalemReady(page);
  },
  async capture(page, t) {
    await page.locator(".sch-own--out").scrollIntoViewIfNeeded();
    await page.click(".sch-own--out");
    await page.waitForSelector("#calMenu:not([hidden]) [data-ground]");
    await settle(page);
    return t.unionClip([".sch-own--out", "#calMenu"], 8);
  },
};
