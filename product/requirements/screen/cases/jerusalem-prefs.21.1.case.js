"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Nothing stored, so this is the row a first visit opens on: no kind named,
// the middle pace, on foot, and food left to the reader.
module.exports = {
  description: "the four questions above the calendar, as a first visit finds them",
  capture: "#prefs",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
};
