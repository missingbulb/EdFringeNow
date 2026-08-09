"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "price panel: 'Cheapest ticket, up to:' over the shared six-step ladder with counts",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="pricePanel"]');
    await page.waitForSelector("#priceOptions .seg-btn");
    await page.waitForTimeout(200);
  },
};
