"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "Show more appends the next page",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  // One fixed region anchored at the last card of the first page, so both
  // frames cover the same strip of the page: the button sitting under that
  // card, then the cards that replaced it.
  async capture(page, t) {
    const last = await t.rectOf(".show-item >> nth=11");
    const region = { x: 0, y: last.y, width: 390, height: 300 };
    const before = await t.clip(region);
    await page.click("#showMore");
    await page.waitForTimeout(400);
    return t.animate([before, await t.clip(region)]);
  },
};
