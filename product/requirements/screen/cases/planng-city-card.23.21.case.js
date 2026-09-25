"use strict";
const { jerusalemReady, routeEdinburghFestivals, settle } = require("../../shared/case-helpers");

/* Pointing at Edinburgh's pill of four festivals. */
module.exports = {
  description: "pointing at a city's pill shows its card: how many festivals, and each one's name and dates",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeEdinburghFestivals(page);
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
  },
  async capture(page, t) {
    await page.hover(".tl-item--bunch .tl-bar");
    await page.waitForSelector(".tl-card:not([hidden])");
    await settle(page);
    return t.unionClip([".tl-item--bunch", ".tl-card"]);
  },
};
