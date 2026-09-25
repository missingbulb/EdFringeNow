"use strict";
const { plannerReady, settle } = require("../../shared/case-helpers");

/* The Haifa trip's first four days, folded and then with the night opened. */
module.exports = {
  description: "every day runs from 08:00 to 01:00, and the plus opens the night from 23:00",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const frame = async () => {
      const cols = await page.$$eval("#schedule .sch-day", (els) => els.slice(0, 4).map((el) => el.dataset.date));
      const rects = [await t.rectOf("#schedule .sch-gutter")];
      for (const d of cols) rects.push(await t.rectOf(`.sch-day[data-date="${d}"]`));
      return t.clip(t.pad(t.union(rects), 4));
    };
    const folded = await frame();
    await page.click("[data-night]");
    await settle(page);
    return t.animate([folded, await frame()]);
  },
};
