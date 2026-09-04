"use strict";
const { plan2Ready } = require("../../shared/case-helpers");
const { plan2Storage } = require("../../shared/plan2-fixture");

module.exports = {
  description: "a question card of picture options; earlier answers already stuck on the postcard",
  page: "/plan2/",
  viewport: "desktop",
  localStorage: plan2Storage("who"),
  ready: plan2Ready,
  capture: ".front",
};
