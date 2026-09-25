"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "asked for from a flight block, the question where you are coming from opens beneath the trip's dates: this city, elsewhere in the country, abroad, or the device's own position",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await page.click('.flight--out [data-origin="ask"]');
  },
  capture: (page, t) => t.unionClip(["#tripRow", "#originCard"]),
};
