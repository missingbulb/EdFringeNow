"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Tuesday's two hours: 20:00 wanted by three shows that all play that night
// only, and 21:00 by two. Each card has a lane of the shows it beat, drawn at
// their own times.
const NIGHT = '.sch-day[data-date="2026-10-20"]';

module.exports = {
  description: "a contested card has a lane beside it drawing each show it beat, from that show's own start to its own end",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    // The bars reach past their slot to the rivals' own times.
    const slots = await page.locator(`${NIGHT} .sch-slot, ${NIGHT} .sch-rival`).all();
    const boxes = [];
    for (const slot of slots) boxes.push(await slot.boundingBox());
    return t.clip(t.pad(t.union(boxes), 10));
  },
};
