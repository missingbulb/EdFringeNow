"use strict";
const { uploadFile } = require("../../shared/case-helpers");

module.exports = {
  description: "last year's favourites: 'None of those N favourites are in this year's programme'",
  capture: "#uploadSummary",
  page: "/plan/",
  viewport: "desktop",
  async drive(page) {
    const rows = [
      "Title,URL",
      "Old One,https://www.edfringe.com/tickets/whats-on/a-2025-show-gone-now",
      "Old Two,https://www.edfringe.com/tickets/whats-on/another-2025-show",
    ].join("\r\n");
    await uploadFile(page, "favourites-2025.csv", rows);
    await page.waitForSelector("#uploadSummary:not([hidden])");
  },
};
