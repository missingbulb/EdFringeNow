"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "the view selector: Closest / Soonest / Map, Closest active by default",
  capture: ".view-row",
  localStorage: nowStorage(),
};
