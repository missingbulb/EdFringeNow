"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "populated count line: 'N shows planned out of M selected!'",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
