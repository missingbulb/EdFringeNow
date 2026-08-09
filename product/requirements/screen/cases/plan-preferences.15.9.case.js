"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "partner nags: 'Need a place to sleep?' in the night zone, 'Transportation sorted?' on trip blocks",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
