"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The Haifa trip reaches Acco: the day given to Acco, which holds free shows,
 * beside the Haifa day before it. */
module.exports = {
  description: "a show's block carries its festival's colour, its kind's emoji and, when free, a Free tag",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const date = await page.$$eval(".sch-day", (cols) => {
      const free = cols.find((col) => col.querySelector(".sch-free"));
      return free ? free.dataset.date : null;
    });
    if (!date) throw new Error("no day holds a free show");
    const cols = await page.$$eval(".sch-day", (els) => els.map((el) => el.dataset.date));
    const pair = [cols[cols.indexOf(date) - 1], date].map((d) => `.sch-day[data-date="${d}"] .sch-body`);
    return t.clip(t.pad(t.union(await Promise.all(pair.map((sel) => t.rectOf(sel)))), 4));
  },
};
