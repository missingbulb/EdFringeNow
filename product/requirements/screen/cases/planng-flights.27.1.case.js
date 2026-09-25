"use strict";
const { jerusalemReady, routeFares, flightsSettled, answerTravel } = require("../../shared/case-helpers");

module.exports = {
  description: "coming from London, the travel card shows the cheapest flight out on the trip's first day and home on its last",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeFares(page);
    await answerTravel(page, { home: "GB", way: "fly" });
    await flightsSettled(page);
  },
  capture: "#originCard",
};
