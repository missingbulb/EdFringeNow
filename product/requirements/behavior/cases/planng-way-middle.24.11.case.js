"use strict";
const { jerusalemReady, routeCrowdedYear } = require("../../shared/case-helpers");

/* Where the grips and the travel pictures sit, as distances from the middle of
 * the strip's rows. */
const place = (page) =>
  page.evaluate(() => {
    const rows = document.querySelector(".tl-rows").getBoundingClientRect();
    const mid = rows.top + rows.height / 2;
    const off = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return Math.round(r.top + r.height / 2 - mid);
    };
    return {
      grips: [off(".tl-handle--from .tl-grip"), off(".tl-handle--to .tl-grip")],
      ways: [off(".tl-way--from"), off(".tl-way--to")],
    };
  });

module.exports = {
  description: "the travel pictures and the trip's grips sit at the middle of the strip's rows, over the festivals beside the trip",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await routeCrowdedYear(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    const expected = { grips: [0, 0], ways: [0, 0] };
    assert.deepEqual(await place(page), expected, "centred on the rows");

    // A travel picture overlays the festivals beside the trip rather than
    // sitting in a lane beneath them.
    const over = await page.evaluate(() => {
      const way = document.querySelector(".tl-way--to").getBoundingClientRect();
      const rows = document.querySelector(".tl-rows").getBoundingClientRect();
      return way.top > rows.top && way.bottom < rows.bottom;
    });
    assert.ok(over, "inside the rows' height");
  },
};
