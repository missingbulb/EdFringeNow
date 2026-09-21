"use strict";
const { planReady, uploadFile, FIXTURE_CSV, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the board survives a reload",
  page: "/plan/",
  viewport: "desktop",
  async capture(page, t) {
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#calWrap:not([hidden])");
    await settle(page);
    const uploaded = await t.element("#calWrap");
    await page.reload({ waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    await settle(page);
    return t.animate([uploaded, await t.element("#calWrap")]);
  },
};
