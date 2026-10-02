"use strict";
const { jerusalemReady, routeCrowdedYear } = require("../../shared/case-helpers");

/* The pointer rests on the middle of the longest festival the rows carry, so
 * the lens spreads the weeks around it and that bar grows wide enough to
 * show its name. */
module.exports = {
  description: "pointing along a crowded year magnifies the weeks under the pointer, and a bar grown wide enough there shows its name",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page, { origin }) {
    await routeCrowdedYear(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
  },
  async capture(page, t) {
    const at = await page.evaluate(() => {
      const bars = [...document.querySelectorAll(".tl-item:not(.is-faint)")].filter((el) => !el.classList.contains("is-focus"));
      const widest = bars.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
      const r = widest.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(at.x - 30, at.y);
    await page.mouse.move(at.x, at.y, { steps: 3 });
    await page.waitForSelector(".tl-item.is-magnified");
    return t.element(".tl-main");
  },
};
