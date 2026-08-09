"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "desktop header: logo, centred Now|Plan nav with Now active, location button",
  capture: ".site-header",
  viewport: "desktop",
  localStorage: nowStorage(),
};
