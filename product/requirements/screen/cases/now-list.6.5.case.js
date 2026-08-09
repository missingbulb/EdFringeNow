"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "a show reachable up to 5 minutes late wears the TOO LATE! stamp and dims",
  capture: '.show-item:has-text("Monks")',
  localStorage: nowStorage(),
};
