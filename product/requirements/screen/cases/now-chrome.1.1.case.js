"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "desktop header: logo, centred Now|Plan nav with Now active, location button",
  viewport: "desktop",
  localStorage: nowStorage(),
};
