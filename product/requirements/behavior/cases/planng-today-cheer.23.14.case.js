"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

/* Goldens freeze every animation, so this reads which ones the page asks for. */
const moves = (page) =>
  page.evaluate(() => {
    const name = (sel) => getComputedStyle(document.querySelector(sel)).animationName;
    return {
      cheering: document.querySelector(".tl-today").classList.contains("is-cheering"),
      sign: name(".tl-sign"),
      arm: name(".tl-dude .dude-arm"),
      leg: name(".tl-dude .dude-leg"),
      body: name(".tl-dude"),
    };
  });

module.exports = {
  description: "the figure moves a little, cheers on a choice, and holds still for reduced motion",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    const idle = await moves(page);
    assert.equal(idle.cheering, false, "standing, not cheering");
    assert.equal(idle.sign, "tl-sign-sway", "the sign sways");
    assert.equal(idle.arm, "tl-arm-swing", "an arm swings");
    assert.equal(idle.leg, "tl-leg-tap", "a foot taps");
    assert.equal(idle.body, "none", "and the figure stays where it stands");

    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    const picked = await moves(page);
    assert.equal(picked.cheering, true, "a festival chosen: it cheers");
    assert.equal(picked.body, "tl-cheer", "jumping");
    assert.equal(picked.arm, "tl-arm-cheer", "its arm thrown up");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const still = await moves(page);
    assert.deepEqual([still.sign, still.arm, still.leg, still.body], ["none", "none", "none", "none"], "reduced motion: nothing moves");
  },
};
