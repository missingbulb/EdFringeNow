"use strict";
const { clickStackBand, jerusalemReady } = require("../../shared/case-helpers");

const CONTESTED = '.sch-day[data-date="2026-10-20"] .sch-slot';

module.exports = {
  description: "clicking the stack offers the hour to one of the shows behind it",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  // Opened inside capture(): the runner settles the scroll between drive and
  // capture, and a scroll closes the popovers.
  async capture(page, t) {
    await clickStackBand(page, page.locator(CONTESTED).first());
    return t.unionClip([`${CONTESTED} >> nth=0`, "#calRivals"], 8);
  },
};
