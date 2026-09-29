"use strict";
const { jerusalemAllDays, jerusalemReady, jerusalemStarred, openCard, settle } = require("../../shared/case-helpers");

const FAVOURITE = '.sch-day[data-date="2026-10-19"] .sch-show.sch-show--fav';
const VERDICT = '#calPreview [data-verdict="noTime"]';

module.exports = {
  description: "resting on a verdict names what it does in the page's own label",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { ...jerusalemStarred(["yolo"]), ...jerusalemAllDays() },
  ready: jerusalemReady,
  async capture(page, t) {
    await openCard(page, FAVOURITE);
    await page.hover(VERDICT);
    await page.waitForSelector("#tip:not([hidden])");
    await settle(page);
    // The verdict rested on and the label it shows, and nothing around them.
    const rects = [await t.rectOf(VERDICT), await t.rectOf("#tip")];
    return t.clipInView(t.pad(t.union(rects), 6));
  },
};
