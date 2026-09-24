"use strict";
const { jerusalemReady, jerusalemVerdicts } = require("../../shared/case-helpers");

// Two nights side by side: Tuesday, where the draft is still guessing and both
// hours show what they turned down, and Wednesday, where one hour is locked.
// The lock is the one thing a card's face says beyond the show itself, and
// nothing on that night is on offer any more.
const OPEN = '.sch-day[data-date="2026-10-20"]';
const SETTLED = '.sch-day[data-date="2026-10-21"]';

module.exports = {
  description: "a locked card is marked as locked, and its hour stops offering anyone else",
  page: "/planNG/",
  viewport: "desktop",
  localStorage: jerusalemVerdicts({ locked: { "noga-dangeli": "2026-10-21T21:00" } }),
  ready: jerusalemReady,
  async capture(page, t) {
    const boxes = [];
    for (const night of [OPEN, SETTLED]) {
      for (const slot of await page.locator(`${night} .sch-slot`).all()) boxes.push(await slot.boundingBox());
    }
    return t.clip(t.pad(t.union(boxes), 10));
  },
};
