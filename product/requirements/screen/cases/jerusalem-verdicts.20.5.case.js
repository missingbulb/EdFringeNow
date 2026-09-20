"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

const BLOCK = '.sch-day[data-date="2026-10-20"] .sch-show';

module.exports = {
  description: "every drafted block offers the four verdicts: lock, favourite, not this night, not this show",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  // The whole block, hovered: the four buttons sit at 40% until the block is
  // under the pointer, so hovering is the state they are read in — and they
  // are read against the show they are a verdict on, not on their own.
  async capture(page, t) {
    await page.hover(`${BLOCK} .sch-foot`);
    await page.waitForTimeout(200);
    return t.element(BLOCK);
  },
};
