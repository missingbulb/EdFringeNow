"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The Haifa trip opens with a sliver either side of the festival. Dragging the
 * day's end up by pointer, every day keeps the width it had when the drag
 * began, the slivers included, until the line is let go. */
const widths = (page) =>
  page.$$eval("#schedule .sch-day", (cols) => cols.map((c) => [c.dataset.date, Math.round(c.getBoundingClientRect().width)]));

module.exports = {
  description: "dragging the day's start or end holds every day at its width",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=haifa-iff`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    const before = await widths(page);
    assert.ok(
      before.some(([, w]) => w < 40),
      "the trip opens with a sliver for a day with nothing on it"
    );

    for (const which of ["end", "start"]) {
      const line = await page.locator(`.sch-dayline--${which} .dl-grip`).boundingBox();
      const x = line.x + line.width / 2;
      const y = line.y + line.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      const step = which === "end" ? -30 : 30;
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(x, y + step * i);
        assert.deepEqual(await widths(page), before, `every day keeps its width while the day's ${which} is dragged`);
      }
      await page.mouse.up();
    }
  },
};
