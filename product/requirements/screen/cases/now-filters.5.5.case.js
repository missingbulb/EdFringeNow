"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "each chip says what it is set to",
  capture: ".filters-row",
  localStorage: nowStorage(),
  async drive(page) {
    // Narrow each chip so all three read a set state at once: two genres, a
    // price cap, and a bike budget.
    await page.click('[data-panel="genrePanel"]');
    await page.click('#genreOptions label:has-text("Theatre")');
    await page.keyboard.press("Escape");
    await page.click('[data-panel="pricePanel"]');
    await page.click('#priceOptions .seg-btn:has-text("£15")');
    await page.keyboard.press("Escape");
    await page.click('[data-panel="travelPanel"]');
    await page.click('#travelOptions label:has-text("Bicycle")');
    await page.locator("#travelRange").fill("25");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  },
};
