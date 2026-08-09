"use strict";
const { planReady, uploadFile, FIXTURE_CSV, PLAN_FAVOURITES } = require("../../shared/case-helpers");

module.exports = {
  description: "uploading the favourites CSV fills the board, and the list survives a reload",
  page: "/plan/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#calWrap:not([hidden])");
    assert.equal(await page.locator(".lane").count(), PLAN_FAVOURITES.length, "one lane per favourite");
    // Persisted (3-day TTL shape) and restored on reload.
    const stored = JSON.parse(
      await page.evaluate(() => localStorage.getItem("edfringe.plan.favourites.v1"))
    );
    assert.equal(stored.v, 1);
    assert.equal(stored.slugs.length, PLAN_FAVOURITES.length);
    assert.equal(stored.filename, "favourites.csv");
    assert.ok(Number.isFinite(stored.savedAt));
    await page.reload({ waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    assert.equal(await page.locator(".lane").count(), PLAN_FAVOURITES.length, "grid restored after reload");
  },
};
