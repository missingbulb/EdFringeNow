"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* A Haifa trip stretched to three weeks: Acco's day is narrower than its
 * name, so the banner ends in an ellipsis inside its own column. Shown with
 * the day either side of it. */
module.exports = {
  description: "a day given to a nearby festival keeps its banner inside its own column",
  page: "/planNG/?from=2026-09-18&to=2026-10-08&festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const date = await page.getAttribute(".sch-day--festival", "data-date");
    const cols = await page.$$eval(".sch-day", (els) => els.map((el) => el.dataset.date));
    const i = cols.indexOf(date);
    const banner = await t.rectOf(".sch-keep--festival");
    const around = await Promise.all(
      cols.slice(Math.max(0, i - 1), i + 2).map((d) => t.rectOf(`.sch-day[data-date="${d}"] .sch-day-head`))
    );
    return t.clip(t.pad(t.union([...around, { ...banner, height: banner.height + 60 }]), 4));
  },
};
