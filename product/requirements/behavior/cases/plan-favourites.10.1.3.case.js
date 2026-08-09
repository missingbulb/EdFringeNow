"use strict";
const { planReady, uploadFile, FIXTURE_CSV, PLAN_FAVOURITES } = require("../../shared/case-helpers");
const { REFERENCE_NOW_UTC_MS } = require("../../shared/reference-now");

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

module.exports = {
  description: "a stored favourites list is kept for three days, then forgotten",
  page: "/plan/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#calWrap:not([hidden])");

    const stored = JSON.parse(
      await page.evaluate(() => localStorage.getItem("edfringe.plan.favourites.v1"))
    );
    assert.equal(stored.slugs.length, PLAN_FAVOURITES.length);
    assert.equal(stored.savedAt, REFERENCE_NOW_UTC_MS, "stamped with the moment it was saved");

    // Age the stored stamp past the window and reload: the list is forgotten,
    // and the board falls back to the intake.
    await page.evaluate((old) => {
      const key = "edfringe.plan.favourites.v1";
      const v = JSON.parse(localStorage.getItem(key));
      v.savedAt = old;
      localStorage.setItem(key, JSON.stringify(v));
    }, REFERENCE_NOW_UTC_MS - THREE_DAYS_MS - 60000);
    await page.reload({ waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#intakeStage .dropzone");
    assert.ok(await page.locator("#calWrap").isHidden(), "an expired list leaves an empty board");
  },
};
