"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* Christmas in the United Kingdom, 2026: Friday and Boxing Day's Saturday,
 * Sunday, and Monday's substitute day, one break of four days. */
module.exports = {
  description: "pointing at an orb explains the break: its holidays, dates, days off and whose holidays they are",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { "planNG.origin": JSON.stringify({ kind: "abroad", country: "GB", arrive: "fly" }) },
  ready: async (page) => {
    await jerusalemReady(page);
    await page.waitForSelector('.tl-orb[data-from="2026-12-25"]');
  },
  async capture(page, t) {
    await page.hover('.tl-orb[data-from="2026-12-25"]');
    await page.waitForSelector(".tl-card:not([hidden])");
    return t.unionClip(['.tl-orb[data-from="2026-12-25"]', ".tl-card"]);
  },
};
