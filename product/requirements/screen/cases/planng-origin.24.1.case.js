"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "a first visit is asked where it is coming from: this city, elsewhere in the country, abroad, or the device's own position",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  capture: "#originCard",
};
