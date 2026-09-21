"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "genre panel: Which genres? + everything!, ten genres with emoji and counts",
  capture: "#genrePanel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="genrePanel"]');
    await page.waitForSelector("#genreOptions label");
    await settle(page);
  },
};
