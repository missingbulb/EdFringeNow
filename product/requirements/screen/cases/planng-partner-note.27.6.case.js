"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the footer's partner-link disclosure under the copyright and data source",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  capture: ".site-footer .footer-copy",
};
