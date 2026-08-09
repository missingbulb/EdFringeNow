"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the schedule: one 09:00→27:00 axis, coloured blocks, travel legs, lunch band, zones, trip blocks",
  async capture(page, t) {
    const sched = await page.locator("#schedule").boundingBox();
    const d3 = await page.locator(".sch-day").nth(2).boundingBox();
    return t.clip({ x: sched.x, y: sched.y, width: d3.x + d3.width - sched.x, height: sched.height });
  },
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
