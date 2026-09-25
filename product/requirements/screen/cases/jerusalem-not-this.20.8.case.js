"use strict";
const { jerusalemReady, settle, openCard } = require("../../shared/case-helpers");

// Tuesday at 20:00, which three one-night shows wanted: refusing the show that
// took it re-drafts the hour from whoever is left, and the stack shrinks by the
// one that has just been taken off the calendar.
const TUE = '.sch-day[data-date="2026-10-20"]';

module.exports = {
  description: "'not this show' hands its hour to the next contender",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const before = await t.element(`${TUE} .sch-body`);
    await openCard(page, `${TUE} .sch-slot >> nth=0 >> .sch-show`);
    await page.click('#calPreview [data-verdict="noShow"]');
    // The next contender slides under the pointer and would reopen a popup
    // over the hour; step the pointer off so the capture shows the day alone.
    await page.mouse.move(0, 0);
    await settle(page);
    return t.animate([before, await t.element(`${TUE} .sch-body`)]);
  },
};
