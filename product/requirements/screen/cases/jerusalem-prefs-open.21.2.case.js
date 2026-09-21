"use strict";
const { jerusalemPrefs, jerusalemReady, settle } = require("../../shared/case-helpers");

// Opened on a pair of numbers that is none of the three pictures — four shows
// a day, three quarters of an hour apart. The question still opens on them,
// which is the point: the pictures are shorthand for the numbers, so a reader
// who has gone past them keeps what they set.
module.exports = {
  description: "a question opens on the exact numbers behind its pictures",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemPrefs({ maxPerDay: 4, minGap: 45 }),
  ready: jerusalemReady,
  async capture(page, t) {
    await page.click("[data-expand='pace']");
    await settle(page);
    return t.element(".pref[data-q='pace']");
  },
};
