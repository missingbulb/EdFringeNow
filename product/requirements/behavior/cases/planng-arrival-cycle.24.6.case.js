"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* The unsettled blocks' picture: three drawings on one spot, taking turns. The
 * harness freezes animations for its captures, so this reads the animation the
 * page asks for rather than watching it run. */
const cycle = (page) =>
  page.$$eval(".flight--out .arrive-icons > svg", (els) =>
    els.map((el) => ({ way: el.dataset.way, animation: getComputedStyle(el).animationName }))
  );

module.exports = {
  description: "while unsettled, the blocks' picture moves between a plane, a train and a car, and holds still for reduced motion",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    const moving = await cycle(page);
    assert.deepEqual(moving.map((m) => m.way), ["fly", "train", "drive"], "a plane, a train and a car");
    assert.ok(moving.every((m) => m.animation === "arrive-turn"), "each takes its turn");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const still = await cycle(page);
    assert.ok(still.every((m) => m.animation === "none"), "reduced motion: none moves");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.click('.flight--out [data-origin="ask"]');
    await page.click('#originCard [data-origin="train"]');
    assert.equal(await page.locator(".flight--out .arrive-icons").count(), 0, "settled, the picture stops turning");
  },
};
