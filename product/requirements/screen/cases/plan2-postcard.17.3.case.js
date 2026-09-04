"use strict";
const { plan2Ready } = require("../../shared/case-helpers");
const { plan2Storage } = require("../../shared/plan2-fixture");

module.exports = {
  description: "the draft: the postcard turned over as a calendar of vertical days, one ticket per item",
  page: "/plan2/",
  viewport: "desktop",
  localStorage: plan2Storage("draft"),
  ready: plan2Ready,
  capture: ".postcard.back",
};
