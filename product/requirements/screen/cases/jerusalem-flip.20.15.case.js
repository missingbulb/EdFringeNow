"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

// Tuesday at 20:00, which three one-night shows wanted: step the card on to the
// next of them, then take it. The pointer is parked off the calendar before each
// frame, so no popup covers the card.
const TUE = '.sch-day[data-date="2026-10-20"]';
const SLOT = `${TUE} .sch-slot--contested >> nth=0`;

module.exports = {
  description: "stepping through a contested card shows each other show in the pick's place, drawn as an offer, until it is taken",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const frame = async () => {
      await page.mouse.move(0, 0);
      await settle(page);
      return t.element(`${TUE} .sch-body`);
    };
    const pick = await frame();
    await page.click(`${SLOT} >> [data-flip="1"]`);
    const offer = await frame();
    await page.click(`${SLOT} >> .sch-flip-take`);
    await page.waitForSelector(`${TUE} .sch-show--locked`);
    const taken = await frame();
    return t.animate([pick, offer, taken]);
  },
};
