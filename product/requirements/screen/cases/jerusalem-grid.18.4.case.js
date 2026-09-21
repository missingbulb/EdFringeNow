"use strict";
const { jerusalemReady, jerusalemStarred, openDrawer } = require("../../shared/case-helpers");

module.exports = {
  description: "the day grid: five festival nights, a mark per performance, the plan's pick in gold, a verdict per lane",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  ready: jerusalemReady,
  // Header plus every lane, stitched from the three columns the row is made
  // of, so the golden is the grid and not the card around it.
  async capture(page, t) {
    await openDrawer(page);
    const label = await page.locator(".lane-label").first().boundingBox();
    const days = await page.locator("#dayHead").boundingBox();
    const status = await page.locator(".lane-status").first().boundingBox();
    const row = async (rect) =>
      t.stitchH(
        [
          await t.clip({ x: label.x, y: rect.y, width: label.width, height: rect.height }),
          await t.clip({ x: days.x, y: rect.y, width: days.width, height: rect.height }),
          await t.clip({ x: status.x, y: rect.y, width: status.width, height: rect.height }),
        ],
        6
      );
    const parts = [await row(await page.locator(".cal-head").boundingBox())];
    const lanes = await page.locator(".lane").all();
    for (const lane of lanes) parts.push(await row(await lane.boundingBox()));
    return t.stitchV(parts, 4);
  },
};
