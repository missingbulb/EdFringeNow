"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "until you have said how you are getting here the blocks look unsettled, and clicking one asks beneath the trip's dates: living there, driving, the train, or flying from a country",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await page.click('.flight--out [data-origin="ask"]');
  },
  capture: (page, t) => t.unionClip(["#tripRow", "#originCard"]),
};
