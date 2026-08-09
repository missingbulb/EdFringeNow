"use strict";
const { uploadFile, FIXTURE_CSV, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "Try again recovers to the working page",
  page: "/plan/",
  viewport: "desktop",
  async ready(page) {
    await page.waitForSelector("#dropzone");
    await settle(page);
  },
  async capture(page, t) {
    // The outage has to predate the page's own boot fetch, so the route goes on
    // before a reload rather than over an already-loaded catalogue.
    let failing = true;
    await page.route("**/normalized/shows.min.json*", (route) =>
      failing ? route.abort("failed") : route.fallback()
    );
    // The catalogue the first boot fetched is in Cache Storage, and a cached
    // copy is served without a network request — so the outage only bites once
    // that copy is gone.
    await page.evaluate(async () => {
      for (const key of await caches.keys()) await caches.delete(key);
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#dropzone");
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#errorState:not([hidden])", { timeout: 20000 });
    await page.waitForTimeout(200);
    const failed = await t.element("#errorState");

    failing = false;
    await page.click("#retryBtn");
    await page.waitForSelector("#calWrap:not([hidden])", { timeout: 20000 });
    await page.waitForTimeout(400);
    return t.animate([failed, await t.element("#board")]);
  },
};
