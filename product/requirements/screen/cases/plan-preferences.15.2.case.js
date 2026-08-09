"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the schedule: one 09:00→27:00 axis, coloured blocks, travel legs, lunch band, zones, trip blocks",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
