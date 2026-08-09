"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the window rail: From 7 Aug / To 24 Aug flags, '18 days' band, Optimize?, dimmed outside",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
