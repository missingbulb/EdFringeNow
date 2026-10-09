"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the year's festivals across the top: one bar per edition, today marked, the focused one lit",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  // Jerusalem is focused (the soonest festival with a programme); Haifa and
  // Acco are drawn hollow, their programmes not published in the fixtures.
  capture: ".timeline",
};
