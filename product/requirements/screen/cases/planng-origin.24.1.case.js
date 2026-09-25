"use strict";
const { jerusalemReady, routeWhere } = require("../../shared/case-helpers");

/* Connecting from the UK, before anything is said: the pictures beside the
 * trip, and the question the first of them opens beneath the strip. */
module.exports = {
  description: "until you have said how you are getting here a travel picture sits beside each end of the trip, and clicking either asks where you live, starting from the country you connect from",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeWhere(page, "GB");
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    await page.waitForFunction(() => document.querySelector(".tl-orb"), null, { timeout: 20000 });
    await page.click(".tl-way--from");
    await page.waitForSelector('#originCard [data-origin="next"]');
  },
  capture: (page, t) => t.unionClip([".tl-track", "#originCard"]),
};
