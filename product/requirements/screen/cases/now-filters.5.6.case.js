"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "everything! ticks them all, then flips to nothing! and clears them",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="genrePanel"]');
    await page.waitForSelector("#genreOptions label");
    await page.waitForTimeout(200);
  },
  async capture(page, t) {
    const frames = [await t.element("#genrePanel")];
    await page.click("#filterReset"); // everything! → all ticked
    await page.waitForTimeout(300);
    frames.push(await t.element("#genrePanel"));
    await page.click("#filterReset"); // nothing! → all cleared
    await page.waitForTimeout(300);
    frames.push(await t.element("#genrePanel"));
    return t.animate(frames);
  },
};
