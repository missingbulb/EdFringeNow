"use strict";
const { jerusalemReady, routeFares, flightsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "coming from London, the cheapest flight out on the trip's first day and home on its last, either side of the trip's dates",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeFares(page);
    await page.selectOption("#originCountry", "GB");
    await flightsSettled(page);
  },
  capture: "#tripRow",
};
