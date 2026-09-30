"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* Goldens land every animation on its end state, so this reads which ones the
 * page asks for: every moved picture glides from where it was, and each
 * subtype capsule unfolds after the one before it. */
const recordAnimations = (page) =>
  page.evaluate(() => {
    window.__asked = [];
    const landed = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      window.__asked.push({
        type: this.dataset.type || null,
        subtype: this.dataset.subtype ?? null,
        chips: this.classList.contains("tl-subtypes"),
        from: keyframes[0].transform || keyframes[0].clipPath || null,
        delay: (options && options.delay) || 0,
      });
      return landed.call(this, keyframes, options);
    };
  });
const asked = (page) => page.evaluate(() => window.__asked.splice(0));

module.exports = {
  description: "choosing a type glides the pictures to their new places and unfolds the subtypes one after another; with reduced motion they simply land",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await recordAnimations(page);

    await page.click('.tl-type[data-type="film"]');
    await settle(page);
    const picked = await asked(page);
    const tiles = picked.filter((a) => a.type);
    assert.equal(new Set(tiles.map((a) => a.type)).size, 9, "all nine pictures move to their new places");
    assert.ok(tiles.every((a) => /^translate\(.+\) scale\(/.test(a.from)), "each starts from where it was");
    assert.ok(picked.some((a) => a.chips && /^inset/.test(a.from)), "the subtypes open downwards");
    const chips = picked.filter((a) => a.subtype !== null);
    assert.deepEqual(
      chips.map((a) => a.subtype),
      ["", "film-international"],
      "each subtype capsule, every subtype first"
    );
    assert.ok(chips[1].delay > chips[0].delay, "one after another");

    await page.click('.tl-type[data-type="film"]');
    await settle(page);
    assert.equal(new Set((await asked(page)).filter((a) => a.type).map((a) => a.type)).size, 9, "and back again");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click('.tl-type[data-type="film"]');
    await settle(page);
    assert.deepEqual(await asked(page), [], "reduced motion: nothing glides, everything lands");
    assert.equal(await page.getAttribute('.tl-type[data-type="film"]', "aria-pressed"), "true", "and the choice is made all the same");
  },
};
