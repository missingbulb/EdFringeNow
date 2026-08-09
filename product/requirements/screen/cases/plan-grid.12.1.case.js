"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the grid: day header, weekend stripes, pre-festival shading, lanes by start time, verdict pills",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
