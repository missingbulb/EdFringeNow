"use strict";
const { jerusalemPrefs, jerusalemReady, settle } = require("../../shared/case-helpers");

// Opened on a pair of numbers that is none of the three pictures — four shows
// a day, three quarters of an hour apart. The panel still opens on them,
// which is the point: the pictures are shorthand for the numbers, so a reader
// who has gone past them keeps what they set.
module.exports = {
  description: "a chip opens a panel over the calendar holding its pictures and the exact numbers behind them",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  viewportOnly: true,
  localStorage: jerusalemPrefs({ maxPerDay: 4, minGap: 45 }),
  ready: jerusalemReady,
  async capture(page, t) {
    await page.click("[data-open='pace']");
    await settle(page);
    return t.unionClip([".pref[data-q='pace'] .pref-chip", "#panel-pace"]);
  },
};
