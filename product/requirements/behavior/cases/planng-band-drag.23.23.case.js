"use strict";
const { jerusalemReady, calendarSpans } = require("../../shared/case-helpers");

/* The band taken hold of on Jerusalem's own pill, inside it, and dragged on
 * two days: the trip moves whole and Jerusalem stays chosen; the drag is no
 * click on the pill. A press on the pill that doesn't move is one. */
module.exports = {
  description: "dragging the band moves the whole trip, keeping its length and the festival chosen; a press that doesn't move still chooses the festival under it",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await calendarSpans(page, "2026-10-17", "2026-10-23");

    const at = await page.evaluate(() => {
      const track = document.querySelector(".tl-track").getBoundingClientRect();
      const bar = document.querySelector('.tl-item[data-festival="jerusalem-comedy"] .tl-bar').getBoundingClientRect();
      const band = document.querySelector(".tl-period").getBoundingClientRect();
      // Mid-band, on the pill, clear of both ends' handles; moved two days of
      // the 365 the year shows, and a quarter more so the rounding lands on two.
      return { x: band.left + band.width / 2, y: bar.top + bar.height / 2, by: (track.width * 2.25) / 365 };
    });
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + at.by / 2, at.y, { steps: 3 });
    await page.mouse.move(at.x + at.by, at.y, { steps: 3 });
    await page.mouse.up();
    await calendarSpans(page, "2026-10-19", "2026-10-25");
    const url = new URL(page.url());
    assert.equal(url.searchParams.get("from"), "2026-10-19", "the whole trip moved on two days");
    assert.equal(url.searchParams.get("to"), "2026-10-25", "its length kept");
    assert.equal(url.searchParams.get("festival"), "jerusalem-comedy", "Jerusalem still chosen");

    // A press that stays put is a click: Jerusalem's run, a day either side.
    await page.click('.tl-item[data-festival="jerusalem-comedy"] .tl-bar');
    await calendarSpans(page, "2026-10-17", "2026-10-23");
  },
};
