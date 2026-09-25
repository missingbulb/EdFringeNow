"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

const HEAD = [".site-header", ".page-head"];

module.exports = {
  description: "the page in each festival's theme: Jerusalem's stone and brass, then Haifa's sea blue",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  // The same region twice, one festival each: the name, the palette and the
  // wash behind them move with the festival chosen; the header above does not.
  async capture(page, t) {
    const jerusalem = await t.unionClip(HEAD, 0);
    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    await page.evaluate(() => window.scrollTo(0, 0));
    const haifa = await t.unionClip(HEAD, 0);
    return t.stitchV([jerusalem, haifa], 8);
  },
};
