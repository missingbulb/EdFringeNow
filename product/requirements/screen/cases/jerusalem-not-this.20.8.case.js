"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Tuesday at 20:00, which three one-night shows wanted: refusing the show that
// took it re-drafts the hour from whoever is left.
const TUE = '.sch-day[data-date="2026-10-20"]';

module.exports = {
  description: "'not this show' hands its hour to the next contender",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const before = await t.element(TUE);
    await page.click(`${TUE} .sch-show [data-verdict="noShow"]`);
    await page.waitForTimeout(350);
    return t.animate([before, await t.element(TUE)]);
  },
};
