"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "place search results: Which one? with kind icons, in-Edinburgh only, plus the keep-as-note row",
  capture: "#destResults",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.fill("#destInput", "waverley");
    await page.click("#destFind");
    await page.waitForSelector(".place-hit");
    await page.waitForTimeout(200);
  },
};
