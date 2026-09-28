"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

// The kinds panel as it opens, Find a show folded under the kinds; then opened,
// with Theatre ticked under genre and only theatre left in the results.
module.exports = {
  description: "what you are here for has a folded second line: the search box, then genre, sub-genre and venue",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  viewportOnly: true,
  ready: jerusalemReady,
  async capture(page, t) {
    await page.click("[data-open='interests']");
    await settle(page);
    const closed = await t.element("#panel-interests");
    await page.click("#eventFilters summary");
    await page.click("[data-panel='ssfKindPanel']");
    await page.check("#ssfKindOptions input[value='theatre']");
    await page.click("[data-panel='ssfKindPanel']");
    await page.waitForSelector("#ssResults .ss-row");
    await page.mouse.move(0, 0);
    await settle(page);
    return t.animate([closed, await t.element("#panel-interests")]);
  },
};
