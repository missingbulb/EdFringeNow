"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The Haifa trip reaches Acco, so a first draft gives Acco a day: that column
 * and the day either side of it. */
module.exports = {
  description: "a day given to a nearby festival drafts only that festival's shows, under its colour",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const date = await page.getAttribute(".sch-day--festival", "data-date");
    const cols = await page.$$eval(".sch-day", (els) => els.map((el) => el.dataset.date));
    const i = cols.indexOf(date);
    const around = cols.slice(Math.max(0, i - 1), i + 2).map((d) => `.sch-day[data-date="${d}"]`);
    return t.clip(t.pad(t.union(await Promise.all(around.map((sel) => t.rectOf(sel)))), 6));
  },
};
