"use strict";
const { jerusalemReady, answerTravel } = require("../../shared/case-helpers");

/* The unsettled pictures: four drawings on one spot, taking turns. The harness
 * freezes animations for its captures, so this reads the animation the page
 * asks for rather than watching it run. */
const cycle = (page) =>
  page.$$eval(".tl-way--from .arrive-icons > svg", (els) =>
    els.map((el) => ({ way: el.dataset.way, animation: getComputedStyle(el).animationName }))
  );

module.exports = {
  description: "while unsettled, the travel pictures take turns as a plane, a train, a car and a house, and hold still for reduced motion",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    const moving = await cycle(page);
    assert.deepEqual(moving.map((m) => m.way), ["fly", "train", "drive", "local"], "a plane, a train, a car and a house");
    assert.ok(moving.every((m) => m.animation === "arrive-turn"), "each takes its turn");
    assert.equal(await page.locator(".tl-way--to .arrive-icons > svg").count(), 4, "at both ends of the trip");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const still = await cycle(page);
    assert.ok(still.every((m) => m.animation === "none"), "reduced motion: none moves");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await answerTravel(page, { home: "IL", way: "train" });
    assert.equal(await page.locator(".tl-way .arrive-icons").count(), 0, "settled, the pictures stop turning");
    assert.deepEqual(
      await page.$$eval(".tl-way > svg", (els) => els.map((el) => el.dataset.way)),
      ["train", "train"],
      "both show the answer"
    );
  },
};
