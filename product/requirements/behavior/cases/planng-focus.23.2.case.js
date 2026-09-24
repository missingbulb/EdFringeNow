"use strict";
const { jerusalemReady, plannerReady, calendarDays } = require("../../shared/case-helpers");

/* Choosing another festival on the timeline: the calendar becomes its run and
 * a day either side, the address names it, and the page opens on it again. */
module.exports = {
  description: "choosing a festival on the timeline sets the period to its run plus a day either side, and the address names it",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const jerusalem = await calendarDays(page);
    assert.equal(jerusalem[0], "2026-10-17", "Jerusalem runs from the 18th: the calendar opens the day before");
    assert.equal(jerusalem[jerusalem.length - 1], "2026-10-23", "and closes the day after the 22nd");

    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    const haifa = await calendarDays(page);
    assert.equal(haifa[0], "2026-09-24", "Haifa runs from 25 Sep: the day before");
    assert.equal(haifa[haifa.length - 1], "2026-10-04", "to 3 Oct: the day after");
    assert.equal(haifa.length, 11, "every day between, one column each");

    const url = new URL(page.url());
    assert.equal(url.searchParams.get("festival"), "haifa-iff", "the address names the festival");
    assert.equal(
      await page.getAttribute('.tl-item[data-festival="haifa-iff"]', "aria-pressed"),
      "true",
      "the chosen bar is the pressed one"
    );

    // The last choice is what a plain /planNG/ opens on next time.
    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    assert.equal((await calendarDays(page))[0], "2026-09-24", "the page reopens on the festival chosen last");

    // And the address alone focuses a festival, whatever was chosen before.
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal((await calendarDays(page))[0], "2026-10-17", "?festival= wins over the stored choice");
  },
};
