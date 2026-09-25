"use strict";
const { jerusalemReady, plannerReady, calendarDays, calendarSpans } = require("../../shared/case-helpers");

/* Choosing a festival on the timeline: the trip becomes its run and a day
 * either side, the address carries the trip's dates, and the page opens on
 * that trip again. */
module.exports = {
  description: "choosing a festival on the timeline sets the trip to its run plus a day either side, and the address carries the dates",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const jerusalem = await calendarDays(page);
    assert.equal(jerusalem[0], "2026-10-17", "a link naming Jerusalem opens the day before its 18th");
    assert.equal(jerusalem[jerusalem.length - 1], "2026-10-23", "and closes the day after the 22nd");

    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    await calendarSpans(page, "2026-09-24", "2026-10-04");
    assert.equal((await calendarDays(page)).length, 11, "Haifa's 25 Sep – 3 Oct and a day either side, one column each");

    const url = new URL(page.url());
    assert.equal(url.searchParams.get("from"), "2026-09-24", "the address names the trip's first day");
    assert.equal(url.searchParams.get("to"), "2026-10-04", "and its last");
    assert.equal(url.searchParams.get("festival"), "haifa-iff", "and the festival chosen, which leads it");
    assert.equal(
      await page.getAttribute('.tl-item[data-festival="haifa-iff"]', "aria-pressed"),
      "true",
      "the chosen festival is the lit one"
    );

    // The last trip is what a plain /planNG/ opens on next time.
    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    assert.equal((await calendarDays(page))[0], "2026-09-24", "the page reopens on the trip set last");

    // And an address with dates opens on them, whatever was set before.
    await page.goto(`${origin}/planNG/?from=2026-10-18&to=2026-10-20`, { waitUntil: "load" });
    await jerusalemReady(page);
    await calendarSpans(page, "2026-10-18", "2026-10-20");
  },
};
