"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the calendar leads: five nights drafted from the whole programme, nothing starred",
  capture: "#scheduleWrap",
  page: "/planNG/",
  viewport: "desktop",
  // No seed at all: this is what a first visit renders, which under the old
  // board-led model was an empty schedule and a prompt to go and star something.
  ready: jerusalemReady,
};
