"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the site header, identical on two festivals: EdFringeNow wordmark, three-way nav with Festivals active",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  // The same bar on two festivals, one above the other: nothing in it moves.
  async capture(page, t) {
    const jerusalem = await t.unionClip([".site-header"], 0);
    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    await page.evaluate(() => window.scrollTo(0, 0));
    const haifa = await t.unionClip([".site-header"], 0);
    return t.stitchV([jerusalem, haifa], 8);
  },
};
