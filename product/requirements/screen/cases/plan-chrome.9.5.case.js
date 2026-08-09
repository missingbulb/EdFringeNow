"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "populated count line: 'N shows planned out of M selected!'",
  capture: ".page-head",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
