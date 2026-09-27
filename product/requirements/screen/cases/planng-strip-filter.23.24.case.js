"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The year with its three menus above it, before and after choosing Comedy:
 * Haifa's film festival and Acco's theatre festival leave the strip. The
 * fixtures' festivals declare no subtypes, so the subtype menu stays hidden. */
module.exports = {
  description: "the menus above the year narrow the festivals it draws",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const region = () => t.unionClip(["#timelineFilters", "#timeline"], 6);
    const before = await region();
    await page.selectOption('[data-filter="kind"]', "comedy");
    await settle(page);
    return t.animate([before, await region()]);
  },
};
