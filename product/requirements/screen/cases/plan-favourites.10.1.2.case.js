"use strict";
const { planReady, uploadFile, FIXTURE_CSV } = require("../../shared/case-helpers");

module.exports = {
  description: "the board survives a reload",
  page: "/plan/",
  viewport: "desktop",
  async capture(page, t) {
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#calWrap:not([hidden])");
    await page.waitForTimeout(400);
    const uploaded = await t.element("#calWrap");
    await page.reload({ waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    await page.waitForTimeout(400);
    return t.animate([uploaded, await t.element("#calWrap")]);
  },
};
