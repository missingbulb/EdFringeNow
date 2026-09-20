"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

// A favourited show that plays three evenings, drafted onto Monday. Refusing
// that one evening moves it to another of its own — and it competes for the
// rest as a scarcer show than it was, which the popup's badge then says.
const MON = '.sch-day[data-date="2026-10-19"]';
const TUE = '.sch-day[data-date="2026-10-20"]';

module.exports = {
  description: "'not this night' moves the show to another of its own nights",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(["yolo"]),
  ready: jerusalemReady,
  async capture(page, t) {
    const pair = () => t.unionClip([MON, TUE], 4);
    const before = await pair();
    // The verdicts live in the popup, so the card has to be opened first.
    await page.hover(`${MON} .sch-show--fav`);
    await page.waitForTimeout(200);
    await page.click('#calPreview [data-verdict="noTime"]');
    await page.waitForTimeout(350);
    return t.animate([before, await pair()]);
  },
};
