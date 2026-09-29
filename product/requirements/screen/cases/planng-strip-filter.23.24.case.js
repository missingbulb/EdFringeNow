"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The year with the globe and place menu at its start and the nine types at
 * its end, before and after choosing Comedy: Haifa's film festival and Acco's
 * theatre festival leave the strip, and the fixtures' festivals declare no
 * subtypes, so no subtype menu appears. */
module.exports = {
  description: "a globe and place menu, and nine pictured types and a subtype menu, beside the year narrow the festivals it draws",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const before = await t.element("#timeline");
    await page.click('.tl-type[data-type="comedy"]');
    await page.mouse.move(0, 0);
    await settle(page);
    return t.animate([before, await t.element("#timeline")]);
  },
};
