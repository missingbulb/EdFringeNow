"use strict";
const { uploadFile } = require("../../shared/case-helpers");

module.exports = {
  description: "a CSV with no show links: 'No favourites in that file'",
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    await uploadFile(page, "empty.csv", "Title,Notes\r\nJust text,No links here\r\n");
    await page.waitForSelector("#uploadSummary:not([hidden])");
  },
};
