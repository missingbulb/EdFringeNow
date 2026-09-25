"use strict";
const { jerusalemReady, routeEdinburghFestivals, settle } = require("../../shared/case-helpers");

/* Edinburgh in August, holding the Fringe and three more festivals: one pill
 * for the city, each festival's run a shade inside it, the flag at its middle. */
module.exports = {
  description: "a city's festivals share one pill: every run drawn inside it, its country's flag at its middle, and a label counting them and naming the one that leads",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeEdinburghFestivals(page);
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    await settle(page);
  },
  capture: ".tl-item--bunch",
};
