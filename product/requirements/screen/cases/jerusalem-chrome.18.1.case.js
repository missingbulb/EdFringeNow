"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the festival header: wordmark, three-way nav with Jerusalem active, the festival's own run",
  capture: ".site-header",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
};
