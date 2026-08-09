"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the window rail: From 7 Aug / To 24 Aug flags, '18 days' band, Optimize?, dimmed outside",
  async capture(page, t) {
    return t.stitchV([
      await t.unionClip(["#winRail", "#hStart", "#hEnd"], 2),
      await t.element(".lane"),
    ]);
  },
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
