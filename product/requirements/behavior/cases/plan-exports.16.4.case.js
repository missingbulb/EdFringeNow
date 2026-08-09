"use strict";
const { planReady, planFavourites, planPrefs } = require("../../shared/case-helpers");

module.exports = {
  description: "export buttons are disabled while nothing is scheduled; the built-here note stands",
  page: "/plan/",
  viewport: "desktop",
  // A 24:45–25:00 day, trip blocks off (they replace the day edges on the
  // boundary days): nothing can schedule.
  localStorage: { ...planFavourites(), ...planPrefs({ v: 1, dayStartMin: 1485, dayEndMin: 1500, arrival: { enabled: false, endMin: 660 }, departure: { enabled: false, startMin: 1320 } }) },
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    await page.waitForTimeout(400);
    assert.ok(await page.locator("#downloadCsvBtn").isDisabled(), "CSV disabled");
    assert.ok(await page.locator("#importIcsBtn").isDisabled(), "ICS disabled");
    assert.equal(
      (await page.textContent(".plan-actions-note")).trim(),
      "Both files are built here in your browser — nothing is uploaded."
    );
  },
};
