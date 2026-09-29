"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The year before and after choosing Israel in the place menu: Haifa's and
 * Acco's festivals share Israel's pill, then stand apart as their cities'. */
module.exports = {
  description: "with the place menu on a country, its festivals bunch by city",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const region = () => t.unionClip(["#timeline .tl-track"], 6);
    const before = await region();
    await page.selectOption('[data-filter="place"]', "IL");
    await settle(page);
    return t.animate([before, await region()]);
  },
};
