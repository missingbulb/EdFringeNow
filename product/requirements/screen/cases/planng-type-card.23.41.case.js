"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "pointing at a type's picture shows its card: its name, how many festivals it holds, its subtypes and the next of them",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    await page.hover('.tl-type[data-type="film"]');
    await page.waitForSelector(".tl-type-card:not([hidden])");
    return t.unionClip(["#timelineTypes .tl-type-grid", ".tl-type-card"]);
  },
};
