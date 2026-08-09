"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "preferences strip defaults: Day 09:00–25:00, Lunch on, Dinner off, 1–3/day, 30 min, Walk",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
