"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");
const { planWithBoth } = require("./now-plan-strip.4.7.1.case.js");

module.exports = {
  description: "the ✕ on the show clears just the show",
  localStorage: nowStorage(),
  drive: planWithBoth,
  async capture(page, t) {
    const before = await t.element("#journeyStrip");
    await page.click('#journeyStrip .plan-node.stop [data-act="remove"]');
    await settle(page);
    return t.animate([before, await t.element("#journeyStrip")]);
  },
};
