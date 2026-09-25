"use strict";
const { jerusalemAllDays, jerusalemReady, jerusalemStarred, openCard, settle } = require("../../shared/case-helpers");

const FAVOURITE = '.sch-day[data-date="2026-10-19"] .sch-show.sch-show--fav';

module.exports = {
  description: "resting on a verdict names what it does in the page's own label",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { ...jerusalemStarred(["yolo"]), ...jerusalemAllDays() },
  ready: jerusalemReady,
  async capture(page, t) {
    await openCard(page, FAVOURITE);
    await page.hover('#calPreview [data-verdict="noTime"]');
    await page.waitForSelector("#tip:not([hidden])");
    await settle(page);
    return t.unionClip(["#calPreview .pop-verdicts", "#tip"], 8);
  },
};
