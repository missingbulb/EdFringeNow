"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

// The question that should set the one-a-day cap, drawn where it will live and
// refusing to be answered — see leaf 21.4.
module.exports = {
  description: "the variety question is offered, and says plainly that it does not work yet",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  viewportOnly: true,
  ready: jerusalemReady,
  async capture(page, t) {
    await page.click("[data-open='interests']");
    await page.locator("#panel-interests .pref-variety").scrollIntoViewIfNeeded();
    await settle(page);
    return t.element("#panel-interests .pref-variety");
  },
};
