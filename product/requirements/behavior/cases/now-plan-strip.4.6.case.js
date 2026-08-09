"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "Open in Maps builds a Google directions URL: origin, destination, travelmode, waypoints",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#mapsRouteLink");
    let href = await page.getAttribute("#mapsRouteLink", "href");
    let url = new URL(href);
    assert.equal(url.hostname, "www.google.com");
    assert.equal(url.pathname, "/maps/dir/");
    assert.equal(url.searchParams.get("api"), "1");
    assert.equal(url.searchParams.get("travelmode"), "walking");
    assert.match(url.searchParams.get("origin"), /^55\.95/);
    assert.ok(url.searchParams.get("destination"));
    assert.equal(url.searchParams.get("waypoints"), null, "no waypoint without a leg show");

    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForTimeout(300);
    href = await page.getAttribute("#mapsRouteLink", "href");
    url = new URL(href);
    assert.ok(url.searchParams.get("waypoints"), "leg show becomes a waypoint");
  },
};
