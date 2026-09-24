"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Tuesday's two hours: 20:00 wanted by three shows that all play that night
// only, and 21:00 by two. Each is drawn as the card that took it in front of
// the ones it beat, so the size of the stack is the size of the contest.
const NIGHT = '.sch-day[data-date="2026-10-20"]';

module.exports = {
  description: "a contested hour is drawn as a stack: the card that won, in front of the ones it beat",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const slots = await page.locator(`${NIGHT} .sch-slot`).all();
    const boxes = [];
    for (const slot of slots) boxes.push(await slot.boundingBox());
    return t.clip(t.pad(t.union(boxes), 10));
  },
};
