"use strict";

module.exports = {
  description: "category rows first: 'Genre Comedy — Filter to N shows'",
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    await page.fill("#ssInput", "comedy");
    await page.waitForSelector(".ss-row--facet");
    await page.waitForTimeout(200);
  },
};
