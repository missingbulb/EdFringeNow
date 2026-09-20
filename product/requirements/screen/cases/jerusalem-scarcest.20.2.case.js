"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Tuesday at 20:00 is wanted by three shows, all playing that night only. The
// block that took it wears why: its own count of nights, and how many it beat.
const CONTESTED = '.sch-day[data-date="2026-10-20"] .sch-show';

module.exports = {
  description: "a contested hour goes to the contender with the fewest nights of its own",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  capture: CONTESTED,
};
