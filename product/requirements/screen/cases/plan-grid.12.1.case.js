"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the grid: day header, weekend stripes, pre-festival shading, lanes by start time, verdict pills",
  async capture(page, t) {
    const dayCols = page.locator("#dayHead .day-col");
    const d0 = await dayCols.nth(4).boundingBox(); // 5 Aug
    const d1 = await dayCols.nth(9).boundingBox(); // 10 Aug
    const daysX = { x: d0.x, w: d1.x + d1.width - d0.x };
    const label = await page.locator(".lane-label").first().boundingBox();
    const status = await page.locator(".lane-status").first().boundingBox();
    const row = async (rect) =>
      t.stitchH(
        [
          await t.clip({ x: label.x, y: rect.y, width: label.width, height: rect.height }),
          await t.clip({ x: daysX.x, y: rect.y, width: daysX.w, height: rect.height }),
          await t.clip({ x: status.x, y: rect.y, width: status.width, height: rect.height }),
        ],
        6
      );
    const parts = [await row(await page.locator(".cal-head").boundingBox())];
    for (let i = 0; i < 3; i++) parts.push(await row(await page.locator(".lane").nth(i).boundingBox()));
    return t.stitchV(parts, 4);
  },
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
