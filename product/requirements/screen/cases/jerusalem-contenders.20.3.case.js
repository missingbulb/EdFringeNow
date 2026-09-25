"use strict";
const { openOthers, jerusalemReady } = require("../../shared/case-helpers");

const CONTESTED = '.sch-day[data-date="2026-10-20"] .sch-slot';

module.exports = {
  description: "resting on the count lists the hour's shows, our pick first, and offers to lock any of the others in its place",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  // Opened inside capture(): the runner settles the scroll between drive and
  // capture, and a scroll closes the popovers.
  async capture(page, t) {
    await openOthers(page, page.locator(CONTESTED).first());
    return t.unionClip([`${CONTESTED} >> nth=0`, "#calRivals"], 8);
  },
};
