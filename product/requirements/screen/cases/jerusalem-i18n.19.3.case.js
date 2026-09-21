"use strict";
const { jerusalemReady, jerusalemStarred, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the header, the board's heading and the preference questions in Russian and in Japanese",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  ready: jerusalemReady,
  // Driven through the page's own picker rather than loaded twice: the three
  // strips that carry the most words per pixel, in each language, stitched.
  async capture(page, t) {
    const strips = [];
    for (const code of ["ru", "ja"]) {
      await page.selectOption("#langSelect", code);
      await page.waitForFunction((c) => document.documentElement.lang === c, code);
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
      strips.push(await t.element(".site-header"));
      strips.push(await t.element(".page-head"));
      strips.push(await t.element("#prefs"));
    }
    return t.stitchV(strips, 8);
  },
};
