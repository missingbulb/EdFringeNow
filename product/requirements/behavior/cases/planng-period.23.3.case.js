"use strict";
const { jerusalemReady, calendarDays, JERUSALEM_EDITION } = require("../../shared/case-helpers");

/* The calendar's two ends each add a day, the added days are remembered for
 * the festival, and the period stops growing at its cap. */
module.exports = {
  description: "the period extends a day at a time from either end, is remembered, and stops at its cap",
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const { MAX_PERIOD_DAYS } = await import("../../../../site/shared/limits.js");
    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await jerusalemReady(page);

    await page.click("#periodEarlier");
    await jerusalemReady(page);
    await page.click("#periodLater");
    await jerusalemReady(page);
    const days = await calendarDays(page);
    assert.equal(days[0], "2026-10-16", "a day before the day before");
    assert.equal(days[days.length - 1], "2026-10-24", "and a day after the day after");

    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.prefs")));
    assert.deepEqual(prefs.periods[JERUSALEM_EDITION], { from: "2026-10-16", to: "2026-10-24" }, "the period is stored for this festival");

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal((await calendarDays(page))[0], "2026-10-16", "and comes back on a reload");

    // A period at the cap offers no more days at either end.
    await page.evaluate(
      ([key, periods]) => {
        const p = JSON.parse(localStorage.getItem("planNG.prefs"));
        p.periods = { [key]: periods };
        localStorage.setItem("planNG.prefs", JSON.stringify(p));
      },
      [JERUSALEM_EDITION, { from: "2026-10-01", to: `2026-10-${String(MAX_PERIOD_DAYS).padStart(2, "0")}` }]
    );
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal((await calendarDays(page)).length, MAX_PERIOD_DAYS, "the stored period at the cap is drawn whole");
    assert.equal(await page.isDisabled("#periodEarlier"), true, "no earlier day past the cap");
    assert.equal(await page.isDisabled("#periodLater"), true, "no later day past the cap");
  },
};
