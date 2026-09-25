"use strict";
const { jerusalemReady, plannerReady, routeEdinburghFestivals, calendarSpans } = require("../../shared/case-helpers");

/* Choosing Edinburgh's pill of four festivals: the Fringe, the one with a
 * programme and the longest run, is chosen. */
module.exports = {
  description: "choosing a city's pill sets the trip to its leading festival's run plus a day either side, and that festival leads",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await routeEdinburghFestivals(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(await page.getAttribute(".tl-item--bunch", "data-bunch"), "4", "the Fringe and three more share one pill");

    await page.click(".tl-item--bunch");
    await plannerReady(page, "edfringe");
    await calendarSpans(page, "2026-08-06", "2026-09-01");
    assert.equal(await page.getAttribute("html", "data-festival"), "edfringe", "the Fringe leads the trip");
    assert.equal(new URL(page.url()).searchParams.get("festival"), "edfringe", "and is the festival chosen");
    assert.equal(await page.getAttribute(".tl-item--bunch", "aria-pressed"), "true", "the city's pill is lit");
  },
};
