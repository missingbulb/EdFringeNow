"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

module.exports = {
  description: "the bed link: Booking.com's Hebrew edition, Jerusalem, shekels, the window's own nights",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planJerusalem/`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Asserted as a URL, never followed — the partner is a real booking site.
    const href = await page.locator(".trip-link").first().getAttribute("href");
    const url = new URL(href);
    assert.equal(url.host, "www.booking.com");
    assert.equal(url.pathname, "/searchresults.he.html", "the Hebrew edition lives at its own path");
    assert.equal(url.searchParams.get("ss"), "Jerusalem");
    assert.equal(url.searchParams.get("selected_currency"), "ILS");

    // The nights are the date window's, not the festival's: narrow the window
    // and the link has to follow it.
    assert.equal(url.searchParams.get("checkin"), "2026-10-18");
    assert.equal(url.searchParams.get("checkout"), "2026-10-22");
    await page.locator("#hStart").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
    const moved = new URL(await page.locator(".trip-link").first().getAttribute("href"));
    assert.equal(moved.searchParams.get("checkin"), "2026-10-19");

    // A partner link is disclosed as one.
    assert.equal(await page.locator(".trip-link").first().getAttribute("rel"), "sponsored noopener noreferrer");
  },
};
