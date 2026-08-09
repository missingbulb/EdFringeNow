"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "footer: tagline, © 2026 Missing Bulb, commission disclosure, quick/legal links",
  capture: ".site-footer",
  localStorage: nowStorage(),
};
