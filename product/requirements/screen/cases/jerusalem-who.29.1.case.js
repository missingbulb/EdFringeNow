"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "\"who's coming?\" is the first chip, opened on a family with children of 5 and 9",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  viewportOnly: true,
  localStorage: { "planNG.prefs": JSON.stringify({ party: { type: "family", ages: [5, 9] } }) },
  ready: jerusalemReady,
  async capture(page, t) {
    await page.click("[data-open='who']");
    await settle(page);
    return t.unionClip([".pref[data-q='who'] .pref-chip", "#panel-who"]);
  },
};
