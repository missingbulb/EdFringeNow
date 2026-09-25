"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The Haifa trip reaches Acco: the first day holding a free show and shows of
 * both festivals. */
module.exports = {
  description: "a show's block carries its festival's colour, its kind's emoji and, when free, a Free tag",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const date = await page.$$eval(".sch-day", (cols) => {
      const mixed = cols.find((col) => {
        const fests = new Set([...col.querySelectorAll(".sch-show")].map((b) => b.dataset.festivalColour));
        return fests.size > 1 && col.querySelector(".sch-free");
      });
      return mixed ? mixed.dataset.date : null;
    });
    if (!date) throw new Error("no day holds a free show and two festivals' shows");
    return t.clip(t.pad(await t.rectOf(`.sch-day[data-date="${date}"] .sch-body`), 4));
  },
};
