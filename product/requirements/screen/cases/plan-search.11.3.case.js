"use strict";

module.exports = {
  description: "category rows first: 'Genre Comedy — Filter to N shows'",
  async capture(page, t) {
    const rects = [];
    const facets = page.locator(".ss-row--facet");
    const n = await facets.count();
    for (let i = 0; i < n; i++) rects.push(await facets.nth(i).boundingBox());
    rects.push(await page.locator(".ss-row:not(.ss-row--facet)").first().boundingBox());
    return t.clip(t.pad(t.union(rects)));
  },
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    await page.fill("#ssInput", "comedy");
    await page.waitForSelector(".ss-row--facet");
    await page.waitForTimeout(200);
  },
};
