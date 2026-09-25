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

async function midFade(page) {
  // Held still so what is sampled is the fade and nothing else.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await page.click('.tl-item[data-festival="haifa-iff"]');
  // Sampled a beat after the theme itself changes, well inside the fade.
  await page.waitForFunction(() => document.documentElement.dataset.festival === "haifa-iff");
  await page.waitForTimeout(100);
  return background(page);
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

    const during = await midFade(page);
    await plannerReady(page, "haifa-iff");
    await page.waitForTimeout(1200);
    const haifa = await background(page);
    assert.notEqual(jerusalem, haifa, "the two festivals' backgrounds differ");
    assert.notEqual(during, jerusalem, "part-way through, the page has left Jerusalem's colour");
    assert.notEqual(during, haifa, "but has not yet reached Haifa's: it fades rather than jumps");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await unfreeze(page);
    assert.equal(await midFade(page), haifa, "with reduced motion asked for, the colours switch at once");
  },
};
