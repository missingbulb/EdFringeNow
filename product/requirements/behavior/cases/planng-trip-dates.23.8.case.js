"use strict";
const { jerusalemReady, calendarDays, calendarSpans } = require("../../shared/case-helpers");

/* The reader sets the trip: a handle dragged along the year, a handle stepped
 * with the keys, a date typed — and the calendar, the address and the stored
 * trip follow each time. A trip past the cap pulls its other end along. */
module.exports = {
  description: "the trip's first and last day are dragged on the timeline, stepped with the keys or typed, and the calendar follows",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const { MAX_PERIOD_DAYS } = await import("../../../../site/shared/limits.js");
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await calendarSpans(page, "2026-10-17", "2026-10-23");

    // A key steps the last day on by one, and leaves the reader on the handle.
    await page.focus(".tl-handle--to");
    await page.keyboard.press("ArrowRight");
    await calendarSpans(page, "2026-10-17", "2026-10-24");
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("tl-handle--to")),
      true,
      "the stepped handle keeps the focus"
    );
    assert.equal(await page.inputValue("#tripTo"), "2026-10-24", "the typed date follows the handle");

    // Dragging the first day's handle to the start of 14 October.
    const at = await page.evaluate(() => {
      const track = document.querySelector(".tl-track").getBoundingClientRect();
      const handle = document.querySelector(".tl-handle--from").getBoundingClientRect();
      // The year shown starts 1 July 2026 and runs 365 days; 14 October is
      // day 105 of it. A quarter-day in, so the drop lands on that edge.
      return {
        from: { x: handle.left + handle.width / 2, y: handle.top + handle.height / 2 },
        to: { x: track.left + (track.width * 105.25) / 365, y: handle.top + handle.height / 2 },
      };
    });
    await page.mouse.move(at.from.x, at.from.y);
    await page.mouse.down();
    await page.mouse.move((at.from.x + at.to.x) / 2, at.to.y, { steps: 4 });
    await page.mouse.move(at.to.x, at.to.y, { steps: 4 });
    await page.mouse.up();
    await calendarSpans(page, "2026-10-14", "2026-10-24");

    // Typing a date.
    await page.fill("#tripFrom", "2026-10-16");
    await calendarSpans(page, "2026-10-16", "2026-10-24");

    const url = new URL(page.url());
    assert.equal(url.searchParams.get("from"), "2026-10-16", "the address follows the trip");
    assert.equal(url.searchParams.get("to"), "2026-10-24");
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.trip"))),
      { from: "2026-10-16", to: "2026-10-24", pick: "jerusalem-comedy@2026" },
      "and so does the stored trip, Jerusalem still chosen"
    );

    // A last day past the cap pulls the first day after it.
    await page.fill("#tripTo", "2026-12-01");
    const capped = new Date(Date.UTC(2026, 11, 1 - (MAX_PERIOD_DAYS - 1))).toISOString().slice(0, 10);
    await calendarSpans(page, capped, "2026-12-01");
    assert.equal((await calendarDays(page)).length, MAX_PERIOD_DAYS, "the trip is held at the cap");

    // A first day typed after the last swaps the two.
    await page.fill("#tripFrom", "2026-12-05");
    await calendarSpans(page, "2026-12-01", "2026-12-05");

    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await calendarSpans(page, "2026-12-01", "2026-12-05");
  },
};
