"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

module.exports = {
  description: "the schedule: the catchable shows across the window, with the walk between venues",
  capture: "#scheduleWrap",
  page: "/planNG/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  ready: jerusalemReady,
};
