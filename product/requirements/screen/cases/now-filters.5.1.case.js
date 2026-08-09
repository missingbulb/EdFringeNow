"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "genre panel: Which genres? + everything!, ten genres with emoji and counts",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="genrePanel"]');
    await page.waitForSelector("#genreOptions label");
    await page.waitForTimeout(200);
  },
};
