"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "partner nags: 'Need a place to sleep?' in the night zone, 'Transportation sorted?' on trip blocks",
  async capture(page, t) {
    return t.stitchV([
      await t.element('.sch-nag:has-text("sleep")'),
      await t.element('.sch-nag:has-text("Transportation")'),
    ]);
  },
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
