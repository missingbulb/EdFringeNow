"use strict";
const { jerusalemReady, openDrawer } = require("../../shared/case-helpers");

const EDINBURGH_KEYS = ["edfringe.plan.favourites.v1", "edfringe.plan.prefs.v1"];

module.exports = {
  description: "starred shows survive a reload, and the Edinburgh planner's stored list is never touched",
  page: "/planJerusalem/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planJerusalem/`, { waitUntil: "load" });
    await jerusalemReady(page);
    await openDrawer(page);

    // Star two shows off the browse list. The first one switches the board to
    // the grid, so the second is starred from the search bar — which is the
    // page's own answer to "how do I keep adding".
    const first = await page.locator("#browseList .ss-row").first().getAttribute("data-slug");
    await page.locator("#browseList .ss-star").first().click();
    await page.waitForSelector(".lane");
    await page.click("#ssInput");
    await page.waitForSelector("#ssResults .ss-row");
    const rows = page.locator("#ssResults .ss-row:not(.is-on)");
    const second = await rows.first().getAttribute("data-slug");
    await rows.first().locator(".ss-star").click();
    await page.waitForFunction(() => document.querySelectorAll(".lane").length === 2);

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    await openDrawer(page);
    const slugs = await page.locator(".lane").evaluateAll((els) => els.map((e) => e.dataset.slug));
    assert.deepEqual(slugs.slice().sort(), [first, second].sort());

    // The two planners share code, never state.
    const leaked = await page.evaluate(
      (keys) => keys.filter((k) => localStorage.getItem(k) !== null),
      EDINBURGH_KEYS
    );
    assert.deepEqual(leaked, [], "the Fringe planner's keys must stay untouched");
    const owned = await page.evaluate(() => Object.keys(localStorage));
    assert.deepEqual(
      owned.filter((k) => !k.startsWith("jerusalemPlan.")),
      [],
      "this page writes nothing outside its own prefix"
    );
  },
};
