"use strict";
const { jerusalemReady, JERUSALEM_EDITION } = require("../../shared/case-helpers");

/* What the old /planJerusalem/ page left in storage, the way it wrote it:
 * the festival's own ids, and the date window as positions in its five
 * nights. The first visit carries it over and removes it. */
module.exports = {
  description: "what a reader saved under /planJerusalem/ is carried over to the festival planner, once",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: {
    "jerusalemPlan.starred": JSON.stringify(["salakh", "opening"]),
    "jerusalemPlan.verdicts": JSON.stringify({ locked: {}, noTime: [], noShow: ["king"] }),
    "jerusalemPlan.prefs": JSON.stringify({ d0: 2, d1: 4, interests: ["stand-up"], mode: "bike" }),
  },
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const store = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    assert.deepEqual(
      Object.keys(store).filter((k) => k.startsWith("jerusalemPlan.")),
      [],
      "nothing is left under the old prefix"
    );
    assert.deepEqual(
      JSON.parse(store["planNG.starred"]),
      ["jerusalem-comedy/salakh", "jerusalem-comedy/opening"],
      "the starred list, in the pool's names"
    );
    assert.deepEqual(JSON.parse(store["planNG.verdicts"]).noShow, ["jerusalem-comedy/king"], "the verdicts");
    const prefs = JSON.parse(store["planNG.prefs"]);
    assert.deepEqual(prefs.interests, ["jerusalem-comedy/stand-up"], "the kinds named");
    assert.equal(prefs.mode, "bike", "the other answers as they were");
    assert.deepEqual(
      prefs.windows[JERUSALEM_EDITION],
      { from: "2026-10-19", to: "2026-10-21" },
      "the second to the fourth night, as dates"
    );
    assert.equal(
      await page.locator('.lane[data-slug="jerusalem-comedy/salakh"]').count(),
      1,
      "and the page draws what was carried over"
    );
  },
};
