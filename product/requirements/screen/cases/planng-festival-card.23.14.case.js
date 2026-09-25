"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "pointing at a festival on the strip shows its card: name, city and genre, dates and length, and its programme's state",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    await page.hover('.tl-item[data-festival="haifa-iff"] .tl-bar');
    await page.waitForSelector(".tl-card:not([hidden])");
    return t.unionClip(['.tl-item[data-festival="haifa-iff"]', ".tl-card"]);
  },
};
