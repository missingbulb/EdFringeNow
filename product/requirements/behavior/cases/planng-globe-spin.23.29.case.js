"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* The globe flicked east to west: it follows the drag, keeps turning after the
 * pointer lets go, and comes to rest. A press that doesn't move leaves it
 * where it is. */
const viewOf = (page) =>
  page.$eval("#timelineGlobe", (c) => ({ view: c.dataset.view, moving: Boolean(c.dataset.moving) }));

module.exports = {
  description: "dragging the globe spins it, and let go while still moving it keeps spinning, slowing to a stop",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.waitForSelector("#timelineGlobe[data-view]");
    const start = await viewOf(page);
    const box = await page.$eval("#timelineGlobe", (c) => {
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    });
    const lngOf = (v) => Number(v.view.split(",")[0]);

    // A press that stays put, on sea far from any festival, is no drag.
    await page.mouse.move(box.x, box.y - box.r * 0.7);
    await page.mouse.down();
    await page.mouse.up();
    assert.equal((await viewOf(page)).view, start.view, "a click turns nothing");

    await page.mouse.move(box.x - 40, box.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x - 40 + i * 10, box.y);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const released = await viewOf(page);
    assert.notEqual(released.view, start.view, "the drag turned the globe");
    assert.ok(released.moving, "still turning once let go");

    await page.waitForFunction(() => !document.getElementById("timelineGlobe").dataset.moving, null, { timeout: 10000 });
    const rest = await viewOf(page);
    const turned = (from, to) => ((((lngOf(from) - lngOf(to)) % 360) + 360) % 360);
    assert.ok(turned(released, rest) > 5, `it glided on westward after the release: ${released.view} to ${rest.view}`);
    await page.waitForTimeout(300);
    assert.equal((await viewOf(page)).view, rest.view, "and then it stopped");
  },
};
