"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Tuesday's two hours: 20:00 wanted by three shows that all play that night
// only, and 21:00 by two. Each card says it is our pick and how many shows it
// was picked from.
const NIGHT = '.sch-day[data-date="2026-10-20"]';

module.exports = {
  description: "a contested hour's card says it is our pick and how many shows it was picked from",
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
