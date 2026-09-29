"use strict";
const { jerusalemReady, routeCrowdedYear } = require("../../shared/case-helpers");

module.exports = {
  description: "however many festivals the year draws, the strip keeps its height and the rows past it scroll inside",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeCrowdedYear(page);
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
  },
  capture: ".timeline",
};
