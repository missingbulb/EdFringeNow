"use strict";
const { plannerReady } = require("../../shared/case-helpers");

// The Fringe's busiest hours are wanted by dozens of shows: more rows than fit
// side by side, so the lane beside the card with the most rows draws them
// thinner, each still capped at its own start and end.

module.exports = {
  description:
    "an hour with more rivals than fit side by side still draws each as its own bar capped at its own start and end, in thinner rows across a wider lane",
  // Five days rather than the whole run, so the columns are wide enough to read.
  page: "/planNG/?festival=edfringe&from=2026-08-10&to=2026-08-14",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "edfringe"),
  async capture(page, t) {
    const rows = await page.$$eval(".sch-rivals--crowd", (els) =>
      els.map((el) => Number(getComputedStyle(el).getPropertyValue("--lanes")))
    );
    const busiest = rows.indexOf(Math.max(...rows));
    const slot = `.sch-slot:has(.sch-rivals--crowd) >> nth=${busiest}`;
    // The bars reach past their slot to the rivals' own times.
    const boxes = [await t.rectOf(slot), await t.rectOf(`.sch-rivals--crowd >> nth=${busiest} >> .sch-crowd`)];
    return t.clip(t.pad(t.union(boxes), 10));
  },
};
