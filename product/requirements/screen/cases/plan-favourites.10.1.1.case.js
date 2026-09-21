"use strict";
const { uploadFile, FIXTURE_CSV, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "uploading the favourites CSV fills the board",
  page: "/plan/",
  viewport: "desktop",
  async capture(page, t) {
    const empty = await t.element("#board");
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#calWrap:not([hidden])");
    await settle(page);
    return t.animate([empty, await t.element("#board")]);
  },
};
