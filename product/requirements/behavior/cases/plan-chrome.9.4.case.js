"use strict";
const { uploadFile, FIXTURE_CSV, PLAN_FAVOURITES } = require("../../shared/case-helpers");

module.exports = {
  description: "Try again re-fetches the catalogue and replays the pending upload",
  page: "/plan/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    // First load fails; the retry succeeds once the outage is lifted.
    let failing = true;
    await page.route("**/normalized/shows.min.json*", (route) => {
      if (failing) return route.abort("failed");
      return route.fallback();
    });
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await page.waitForSelector("#dropzone");
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#errorState:not([hidden])", { timeout: 20000 });
    failing = false;
    await page.click("#retryBtn");
    await page.waitForSelector("#calWrap:not([hidden])", { timeout: 20000 });
    assert.ok(await page.locator("#errorState").isHidden(), "error state cleared");
    assert.equal(await page.locator(".lane").count(), PLAN_FAVOURITES.length, "the upload was replayed");
  },
};
