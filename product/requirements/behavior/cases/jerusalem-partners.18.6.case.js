"use strict";
const { jerusalemReady, jerusalemStarred, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the bed link: Booking.com's Hebrew edition, Jerusalem, shekels, the window's own nights",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Asserted as a URL, never followed — the partner is a real booking site.
    const href = await page.locator(".trip-link").first().getAttribute("href");
    const url = new URL(href);
    assert.equal(url.host, "www.booking.com");
    assert.equal(url.pathname, "/searchresults.he.html", "the Hebrew edition lives at its own path");
    assert.equal(url.searchParams.get("ss"), "Jerusalem");
    assert.equal(url.searchParams.get("selected_currency"), "ILS");

    // The nights are the date window's, not the festival's — which opens on
    // the run and a day either side (23.2) — so narrow the window and the link
    // has to follow it.
    assert.equal(url.searchParams.get("checkin"), "2026-10-17");
    assert.equal(url.searchParams.get("checkout"), "2026-10-23");
    await page.locator(".sch-dateedge--start").focus();
    await page.keyboard.press("ArrowRight");
    await settle(page);
    const moved = new URL(await page.locator(".trip-link").first().getAttribute("href"));
    assert.equal(moved.searchParams.get("checkin"), "2026-10-18");

    // A partner link is disclosed as one.
    assert.equal(await page.locator(".trip-link").first().getAttribute("rel"), "sponsored noopener noreferrer");
  },
};
