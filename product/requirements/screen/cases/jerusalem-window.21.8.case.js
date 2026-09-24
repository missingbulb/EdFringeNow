"use strict";
const { jerusalemPrefs, jerusalemReady } = require("../../shared/case-helpers");

/* Three of the festival's five nights: the two the window leaves out are
 * hatched like the hours outside the day, with a draggable edge at each end of
 * the window. */
module.exports = {
  description: "the first and last nights are the same kind of blocker, on the same calendar",
  capture: "#scheduleWrap",
  page: "/planNG/",
  viewport: "desktop",
  localStorage: jerusalemPrefs({ d0: 2, d1: 4 }),
  ready: jerusalemReady,
};
