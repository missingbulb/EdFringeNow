"use strict";
const { plannerReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the Edinburgh Fringe chosen on the timeline: its theme, its dates and its programme drafted",
  page: "/planNG/?festival=edfringe",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "edfringe"),
  // The page's head in the Fringe's theme over the questions and the first
  // days of the calendar, where its kinds and its draft show.
  async capture(page, t) {
    const head = await t.unionClip([".site-header", ".page-head"], 0);
    const prefs = await t.element("#prefs");
    const calendar = await t.element("#scheduleWrap");
    return t.stitchV([head, prefs, calendar], 8);
  },
};
