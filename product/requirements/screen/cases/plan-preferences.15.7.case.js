"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the one-sentence summary: 'Planned N of M shows across D days (7–24 Aug).'",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
