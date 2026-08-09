"use strict";
const { nowStorage, nowReady, planReady } = require("../../shared/case-helpers");

module.exports = {
  description: "both pages offer the same ticket-price ladder",
  viewport: "desktop",
  localStorage: nowStorage(),
  async capture(page, t) {
    const origin = page.url().split("/").slice(0, 3).join("/");
    await page.click('[data-panel="pricePanel"]');
    await page.waitForSelector("#priceOptions .seg-btn");
    await page.waitForTimeout(200);
    const nowLadder = await t.element("#pricePanel");

    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.click("#ssToolsBtn");
    await page.waitForSelector("#ssTools:not([hidden])");
    await page.click('[data-panel="ssfPricePanel"]');
    await page.waitForSelector("#ssfPriceOptions label");
    await page.waitForTimeout(200);
    return t.stitchH([nowLadder, await t.element("#ssfPricePanel")]);
  },
};
