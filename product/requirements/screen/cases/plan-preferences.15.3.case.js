"use strict";
const { planFavourites, planPrefs } = require("../../shared/case-helpers");

module.exports = {
  description: "verdict pills: ✓ Scheduled!, ▲Lunch conflict, Can't fit, Sold out, 📅 No dates",
  page: "/plan/",
  viewport: "desktop",
  // Pinning full-blown-redacted to Aug 15 20:45 leaves the (fixture-trimmed)
  // one-performance 100-scouse-comedy with nowhere to go: Can't fit.
  localStorage: {
    ...planFavourites(),
    ...planPrefs({ v: 1, forced: [["100-full-blown-redacted", "2026-08-15T20:45"]] }),
  },
};
