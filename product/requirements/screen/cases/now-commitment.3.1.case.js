"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "no commitment: faded skeleton plan under the Tap-to-set-constraints trigger",
  capture: ".cta-card",
  localStorage: nowStorage(),
};
