"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

const CONTESTED = '.sch-day[data-date="2026-10-20"] .sch-show';

module.exports = {
  description: "the block names the contenders it beat, each with its own count of nights",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  // Opened inside capture(): the runner settles the scroll between drive and
  // capture, and a scroll closes the popovers.
  async capture(page, t) {
    await page.click(`${CONTESTED} .sch-rivals-btn`);
    await page.waitForTimeout(200);
    return t.unionClip([CONTESTED, "#calRivals"], 8);
  },
};
