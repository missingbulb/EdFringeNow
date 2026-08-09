"use strict";
const { nowStorage, nowSettings, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "a pin click selects without scrolling; list and map are one-at-a-time views",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    assert.ok(await page.locator("#map").isHidden(), "map hidden in list view");
    await page.click('.view-btn[data-mode="map"]');
    await page.waitForSelector(".leaflet-tile-loaded");
    assert.ok(await page.locator("#shows").isHidden(), "list hidden in map view");
    const before = await page.evaluate(() => window.scrollY);
    await page.click(".genre-pin >> nth=0");
    await page.waitForTimeout(400);
    assert.ok(await page.locator(".gpin--leg, .gpin--selected").count() > 0, "a pin took the selection");
    assert.equal(await page.evaluate(() => window.scrollY), before, "no scroll on pin click");
  },
};
