"use strict";
const { uploadFile } = require("../../shared/case-helpers");

module.exports = {
  description: "a non-CSV file is refused: 'That's not a CSV file' + export advice + favourites link",
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    await uploadFile(page, "notes.txt", "not a csv", "text/plain");
    await page.waitForSelector("#uploadSummary:not([hidden])");
  },
};
