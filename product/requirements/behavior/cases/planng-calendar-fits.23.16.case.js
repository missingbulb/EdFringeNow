"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

const CAP_PX = 260;

/* The calendar's width against the space it has: its scroller never has more
 * to scroll than it shows, and a column is never wider than the cap. */
const layout = (page) =>
  page.evaluate(() => {
    const wrap = document.querySelector("#schedule").closest(".schedule-wrap");
    const cols = [...document.querySelectorAll("#schedule .sch-day")].map((c) => c.getBoundingClientRect().width);
    return {
      overflow: wrap.scrollWidth - wrap.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      days: cols.length,
      widest: Math.max(...cols),
      sheds: ["cols-narrow", "cols-tiny"].filter((c) => document.querySelector("#schedule").classList.contains(c)),
    };
  });

module.exports = {
  description: "the calendar never scrolls sideways, and a day's column is capped",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "mobile",
  async verify(page, { origin, assert }) {
    const open = async (query, size) => {
      if (size) await page.setViewportSize(size);
      await page.goto(`${origin}/planNG/?festival=jerusalem-comedy${query}`, { waitUntil: "load" });
      await jerusalemReady(page);
      return layout(page);
    };

    const phone = await open("");
    assert.equal(phone.days, 7, "a week on a phone");
    assert.ok(phone.overflow <= 0, `nothing to scroll sideways on a phone (${phone.overflow}px over)`);
    assert.ok(phone.page <= 0, "nor does the page itself");
    assert.deepEqual(phone.sheds, ["cols-narrow", "cols-tiny"], "a phone's squeezed columns shed times, pictures and venues");

    const month = await open("&from=2026-10-10&to=2026-11-09", { width: 1280, height: 900 });
    assert.equal(month.days, 31, "the longest trip allowed");
    assert.ok(month.overflow <= 0, `31 days fit a desk's width (${month.overflow}px over)`);

    const wide = await open("", { width: 2560, height: 1200 });
    assert.equal(wide.days, 7);
    assert.ok(wide.widest <= CAP_PX + 1, `a column stops at ${CAP_PX}px (widest ${wide.widest}px)`);
    assert.ok(wide.widest >= CAP_PX - 1, "and reaches it when there is room");
    assert.deepEqual(wide.sheds, [], "a column with room keeps everything");
  },
};
