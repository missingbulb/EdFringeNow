"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

module.exports = {
  description: "the whole page in dark mode, as a device that asks for one gets it",
  page: "/planNG/",
  viewport: "desktop",
  // Nothing stored and no ?theme=: what the golden shows is the default a dark
  // device is given, not a choice someone made.
  colorScheme: "dark",
  localStorage: jerusalemStarred(),
  ready: jerusalemReady,
};
