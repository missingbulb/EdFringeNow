"use strict";
const { jerusalemReady, reachableLeg, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "resting on the travel between two shows says how, how long, from where to where, and the time it leaves",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const LEG = await reachableLeg(page);
    await page.hover(LEG);
    await page.waitForSelector("#calPreview.cal-pop--leg:not([hidden])");
    await settle(page);
    return t.unionClip([LEG, "#calPreview"], 8);
  },
};
