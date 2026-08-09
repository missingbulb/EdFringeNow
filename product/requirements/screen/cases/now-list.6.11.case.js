"use strict";
const { nowStorage } = require("../../shared/case-helpers");

const CARD = '.show-item:has-text("A Good Time Charlie")';

module.exports = {
  description: "tapping a card slips the show into the plan; tapping again takes it out",
  localStorage: nowStorage(),
  async capture(page, t) {
    const frames = [await t.element(CARD)];
    await page.click(CARD);
    await page.waitForSelector(".show-item--leg");
    await page.waitForTimeout(300);
    frames.push(await t.element(CARD));
    await page.click(CARD);
    await page.waitForTimeout(400);
    frames.push(await t.element(CARD));
    return t.animate(frames);
  },
};
