"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "after the ICS download: 'Downloaded — now into Google Calendar' with the two steps",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async drive(page) {
    const download = page.waitForEvent("download");
    await page.click("#importIcsBtn");
    await download;
    await page.waitForSelector("#icsHowto:not([hidden])");
    await page.waitForTimeout(250);
  },
};
