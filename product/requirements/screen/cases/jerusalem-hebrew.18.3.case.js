"use strict";
const { jerusalemReady, jerusalemStarred, openDrawer } = require("../../shared/case-helpers");

module.exports = {
  description: "one Hebrew show as a grid lane and as a search row — title, venue and kind in the source's own script",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  ready: jerusalemReady,
  // The same show twice, stitched: the lane names it alone, the search row
  // names it with its venue and kind. Between them they cover every place the
  // page renders a string that came out of the programme.
  async capture(page, t) {
    await openDrawer(page);
    const lane = await page.locator('.lane[data-slug="salakh"]').boundingBox();
    await page.click("#ssInput");
    await page.fill("#ssInput", "סלאח");
    await page.waitForSelector('#ssResults .ss-row[data-slug="salakh"]');
    await page.waitForTimeout(200);
    const row = await page.locator('#ssResults .ss-row[data-slug="salakh"]').boundingBox();
    return t.stitchV(
      [
        await t.clip({ x: lane.x, y: lane.y - 2, width: lane.width, height: lane.height + 4 }),
        await t.clip({ x: row.x, y: row.y - 2, width: row.width, height: row.height + 4 }),
      ],
      8
    );
  },
};
