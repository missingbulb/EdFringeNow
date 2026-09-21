"use strict";
const { nowStorage, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "everything! ticks them all, then flips to nothing! and clears them",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="genrePanel"]');
    await page.waitForSelector("#genreOptions label");
    await settle(page);
  },
  async capture(page, t) {
    const frames = [await t.element("#genrePanel")];
    await page.click("#filterReset"); // everything! → all ticked
    await settle(page);
    frames.push(await t.element("#genrePanel"));
    await page.click("#filterReset"); // nothing! → all cleared
    await settle(page);
    frames.push(await t.element("#genrePanel"));
    return t.animate(frames);
  },
};
