"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

// The question that should set the one-a-day cap, drawn where it will live and
// refusing to be answered — see leaf 21.4.
module.exports = {
  description: "the variety question is offered, and says plainly that it does not work yet",
  page: "/planNG/",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    await page.click("[data-expand='interests']");
    await settle(page);
    return t.element(".pref[data-q='interests'] .pref-fine");
  },
};
