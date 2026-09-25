"use strict";
const { jerusalemAllDays, jerusalemReady, jerusalemStarred, settle } = require("../../shared/case-helpers");

const FAVOURITE = '.sch-day[data-date="2026-10-19"] .sch-show.sch-show--fav';

module.exports = {
  description: "a picture that does not load gives way to the kind's emoji",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { ...jerusalemStarred(["yolo"]), ...jerusalemAllDays() },
  failData: ["comedy-festival.co.il/wp-content/uploads/"],
  ready: jerusalemReady,
  async capture(page, t) {
    await page.hover(FAVOURITE);
    await page.waitForSelector("#calPreview .pop-art--emoji");
    await settle(page);
    return t.clip(t.pad(await t.rectOf("#calPreview"), 8));
  },
};
