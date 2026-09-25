"use strict";
const { plannerReady, settle } = require("../../shared/case-helpers");

// The Haifa trip pools Haifa and Acco, so the tags come from two festivals.
// Double Feature is required and The Family Show ruled out, so all three states
// a tag can be in are on screen at once.
module.exports = {
  description: "the kinds are the same eight for every festival, with each festival's own tags beneath them",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  viewportOnly: true,
  localStorage: {
    "planNG.prefs": JSON.stringify({ tags: { "haifa-iff/1025": "only", "haifa-iff/4355": "out" } }),
  },
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    await page.click("[data-open='interests']");
    await settle(page);
    return t.unionClip([".pref[data-q='interests'] .pref-chip", "#panel-interests"]);
  },
};
