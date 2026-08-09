"use strict";
const { planFavourites, planPrefs } = require("../../shared/case-helpers");

module.exports = {
  description: "nothing schedulable: the widen-your-dates message",
  page: "/plan/",
  viewport: "desktop",
  // A 24:45–25:00 day, trip blocks off (they replace the day edges on the
  // boundary days): nothing can schedule.
  localStorage: { ...planFavourites(), ...planPrefs({ v: 1, dayStartMin: 1485, dayEndMin: 1500, arrival: { enabled: false, endMin: 660 }, departure: { enabled: false, startMin: 1320 } }) },
};
