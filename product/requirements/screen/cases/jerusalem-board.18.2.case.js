"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the empty board: the whole programme offered for browsing, with the search bar under it",
  capture: "#board",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
};
