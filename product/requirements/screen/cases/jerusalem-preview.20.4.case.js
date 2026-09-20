"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

// A show with more than one night, so the preview has something to preview:
// favouriting it seats it, and it plays three evenings.
const FAVOURITE = '.sch-day[data-date="2026-10-19"] .sch-show.sch-show--fav';

module.exports = {
  description: "hovering a block previews that show's other nights",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(["yolo"]),
  ready: jerusalemReady,
  async capture(page, t) {
    await page.hover(FAVOURITE);
    await page.waitForTimeout(200);
    return t.unionClip([FAVOURITE, "#calPreview"], 8);
  },
};
