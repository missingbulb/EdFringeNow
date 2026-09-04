"use strict";
const { plan2Ready } = require("../../shared/case-helpers");
const { plan2Storage } = require("../../shared/plan2-fixture");

module.exports = {
  description: "the opening: the city's postcard, festivals as stamps, dates as the postmark, the Where to? card",
  page: "/plan2/",
  viewport: "desktop",
  localStorage: plan2Storage("where"),
  ready: plan2Ready,
  capture: ".front",
};
