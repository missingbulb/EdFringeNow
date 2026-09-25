"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

/* The theme fading between festivals. The harness freezes every transition
 * for its goldens, so this case lifts that freeze first and reads the page's
 * background colour part-way through the change. */
const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function unfreeze(page) {
  await page.evaluate(() => {
    for (const s of document.querySelectorAll("style")) {
      if (s.textContent.includes("transition-duration: 0s !important")) s.remove();
    }
  });
}

/* Every background the page shows, frame by frame, from the moment the theme
 * changes until the fade must be over: a busy machine may drop frames, but not
 * the whole fade. */
async function fadeFrames(page) {
  const frames = page.evaluate(
    () =>
      new Promise((resolve) => {
        const seen = [];
        new MutationObserver((_, observer) => {
          if (document.documentElement.dataset.festival !== "haifa-iff") return;
          observer.disconnect();
          const until = performance.now() + 900;
          const sample = () => {
            seen.push(getComputedStyle(document.body).backgroundColor);
            if (performance.now() < until) requestAnimationFrame(sample);
            else resolve(seen);
          };
          sample();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-festival"] });
      })
  );
  await page.click('.tl-item[data-festival="haifa-iff"]');
  return frames;
}

module.exports = {
  description: "choosing another festival fades the page's colours into its theme, and switches at once under reduced motion",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await unfreeze(page);
    const jerusalem = await background(page);

    const frames = await fadeFrames(page);
    await plannerReady(page, "haifa-iff");
    await page.waitForTimeout(1200);
    const haifa = await background(page);
    assert.notEqual(jerusalem, haifa, "the two festivals' backgrounds differ");
    assert.ok(
      frames.some((c) => c !== jerusalem && c !== haifa),
      `part-way through, the page is between Jerusalem's colour and Haifa's: it fades rather than jumps (${frames.join(", ")})`
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await unfreeze(page);
    const still = await fadeFrames(page);
    assert.deepEqual([...new Set(still)], [haifa], "with reduced motion asked for, the colours switch at once");
  },
};
