"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");

// Both 4.7 halves start from the same plan: a commitment plus a slipped-in show.
async function planWithBoth(page) {
  await page.click(".cta-trigger");
  await page.waitForSelector("#constraintPanel:not([hidden])");
  await settle(page);
  await page.click('.show-pick:has-text("Masala")');
  await page.waitForSelector("#journeyStrip .plan-node");
  await page.click('.show-item:has-text("A Good Time Charlie")');
  await page.waitForSelector("#journeyStrip .plan-node.stop");
  await settle(page);
}

module.exports = {
  description: "the ✕ on the commitment clears it and keeps the picked show",
  localStorage: nowStorage(),
  drive: planWithBoth,
  async capture(page, t) {
    const before = await t.element("#journeyStrip");
    await page.click('#journeyStrip .plan-node.dest [data-act="remove"]');
    await settle(page);
    return t.animate([before, await t.element("#journeyStrip")]);
  },
  planWithBoth,
};
