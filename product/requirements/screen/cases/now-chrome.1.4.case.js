"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "the footer copyright line opens a popup carrying the version",
  localStorage: nowStorage(),
  // Opened inside capture(), not drive(): the runner settles the scroll between
  // the two, and scrolling moves the line out from under the pointer — which
  // fires mouseleave and closes the popup, exactly as it should for a user.
  async capture(page, t) {
    await page.click("#footerVersion");
    await page.waitForSelector(".version-pop:not([hidden])");
    await page.waitForTimeout(150);
    // The popup floats above the line, so the region is their union.
    return t.unionClip(["#footerVersion", ".version-pop"]);
  },
};
