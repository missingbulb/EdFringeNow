"use strict";
const { plannerReady, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the festivals chip lists every festival the trip reaches, each in its colour, with Acco left out",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  viewportOnly: true,
  localStorage: { "planNG.prefs": JSON.stringify({ festivalsOut: ["acco"] }) },
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    await page.click("[data-open='festivals']");
    await settle(page);
    return t.unionClip([".pref[data-q='festivals'] .pref-chip", "#panel-festivals"]);
  },
};
