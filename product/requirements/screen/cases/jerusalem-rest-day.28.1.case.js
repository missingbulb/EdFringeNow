"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* The day a first draft keeps, with the day either side of it: the kept day is
 * one block over its column, and its neighbours draft as before. */
module.exports = {
  description: "a first draft keeps one day for rest: one block across its column, nothing drafted in it",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const date = await page.getAttribute(".sch-day--kept", "data-date");
    const cols = await page.$$eval(".sch-day", (els) => els.map((el) => el.dataset.date));
    const i = cols.indexOf(date);
    const around = cols.slice(Math.max(0, i - 1), i + 2).map((d) => `.sch-day[data-date="${d}"]`);
    return t.clip(t.pad(t.union(await Promise.all(around.map((sel) => t.rectOf(sel)))), 6));
  },
};
