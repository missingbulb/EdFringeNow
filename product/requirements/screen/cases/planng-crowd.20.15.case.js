"use strict";
const { plannerReady } = require("../../shared/case-helpers");

// The Fringe's busiest hours are wanted by dozens of shows: too many rows to
// tell apart, so the lane beside the busiest such card is one wash, darkest
// where most overlap, under a count.

module.exports = {
  description: "an hour with more rivals than fit side by side draws them as one wash under a count",
  // Five days rather than the whole run, so the columns are wide enough to read.
  page: "/planNG/?festival=edfringe&from=2026-08-10&to=2026-08-14",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "edfringe"),
  async capture(page, t) {
    const counts = await page.$$eval(".sch-rivals--crowd .sch-rivals-count", (els) => els.map((el) => Number(el.textContent)));
    const busiest = counts.indexOf(Math.max(...counts));
    return t.clip(t.pad(await t.rectOf(`.sch-slot:has(.sch-rivals--crowd) >> nth=${busiest}`), 10));
  },
};
