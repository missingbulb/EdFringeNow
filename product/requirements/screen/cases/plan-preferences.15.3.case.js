"use strict";
const { planFavourites, planPrefs } = require("../../shared/case-helpers");

module.exports = {
  description: "verdict pills: ✓ Scheduled!, ▲Lunch conflict, Can't fit, Sold out, 📅 No dates",
  async capture(page, t) {
    const lanes = await page.locator(".lanes").boundingBox();
    const label = await page.locator(".lane-label").first().boundingBox();
    const status = await page.locator(".lane-status").first().boundingBox();
    return t.stitchH(
      [
        await t.clip({ x: label.x, y: lanes.y, width: label.width, height: lanes.height }),
        await t.clip({ x: status.x, y: lanes.y, width: status.width, height: lanes.height }),
      ],
      6
    );
  },
  page: "/plan/",
  viewport: "desktop",
  // Pinning full-blown-redacted to Aug 15 20:45 leaves the (fixture-trimmed)
  // one-performance 100-scouse-comedy with nowhere to go: Can't fit.
  localStorage: {
    ...planFavourites(),
    ...planPrefs({ v: 1, forced: [["100-full-blown-redacted", "2026-08-15T20:45"]] }),
  },
};
