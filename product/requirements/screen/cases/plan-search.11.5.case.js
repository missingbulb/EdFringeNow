"use strict";

module.exports = {
  description: "Search tools: six facet chips; genre panel open with counts and everything!",
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    await page.click("#ssToolsBtn");
    await page.waitForSelector("#ssTools:not([hidden])");
    await page.click('[data-panel="ssfGenrePanel"]');
    await page.waitForSelector("#ssfGenreOptions label");
    await page.waitForTimeout(200);
  },
};
