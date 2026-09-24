"use strict";
const { jerusalemPrefs, jerusalemReady } = require("../../shared/case-helpers");

/* The day pulled in around the evening the festival actually runs: a start at
 * 17:30 with the hours before it shaded behind the line, and an end at 22:30
 * with the rest of the night shaded below. */
module.exports = {
  description: "where your day starts and ends, as two blockers on the calendar",
  capture: "#scheduleWrap",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: jerusalemPrefs({ dayStartMin: 17 * 60 + 30, dayEndMin: 22 * 60 + 30 }),
  ready: jerusalemReady,
};
