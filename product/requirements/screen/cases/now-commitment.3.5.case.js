"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "place search results: Which one? with kind icons, in-Edinburgh only, plus the keep-as-note row",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.fill("#destInput", "waverley");
    await page.click("#destFind");
    await page.waitForSelector(".place-hit");
    await page.waitForTimeout(200);
  },
};
