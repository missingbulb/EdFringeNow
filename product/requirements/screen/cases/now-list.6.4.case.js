"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "a show with no online tickets wears the SOLD OUT! stamp and dims",
  capture: '.show-item:has-text("Ray Bradshaw")',
  localStorage: nowStorage(),
};
