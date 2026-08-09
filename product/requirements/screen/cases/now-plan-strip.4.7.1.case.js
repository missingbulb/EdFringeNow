"use strict";
const { nowStorage } = require("../../shared/case-helpers");

// Both 4.7 halves start from the same plan: a commitment plus a slipped-in show.
async function planWithBoth(page) {
  await page.click(".cta-trigger");
  await page.waitForSelector("#constraintPanel:not([hidden])");
  await page.waitForTimeout(400);
  await page.click('.show-pick:has-text("Masala")');
  await page.waitForSelector("#journeyStrip .plan-node");
  await page.click('.show-item:has-text("A Good Time Charlie")');
  await page.waitForSelector("#journeyStrip .plan-node.stop");
  await page.waitForTimeout(200);
}

module.exports = {
  description: "the ✕ on the commitment clears it and keeps the picked show",
  localStorage: nowStorage(),
  drive: planWithBoth,
  async capture(page, t) {
    const before = await t.element("#journeyStrip");
    await page.click('#journeyStrip .plan-node.dest [data-act="remove"]');
    await page.waitForTimeout(400);
    return t.animate([before, await t.element("#journeyStrip")]);
  },
  planWithBoth,
};
