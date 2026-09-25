"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

/* The city photographs cross-fading. As with the colours (23.10), the harness
 * freezes every transition for its goldens, so this case lifts the freeze and
 * reads both photographs' opacity frame by frame. */
const JERUSALEM = "/planNG/cities/jerusalem.webp";
const HAIFA = "/planNG/cities/haifa.webp";

async function unfreeze(page) {
  await page.evaluate(() => {
    for (const s of document.querySelectorAll("style")) {
      if (s.textContent.includes("transition-duration: 0s !important")) s.remove();
    }
  });
}

/* Each photograph's opacity, keyed by its file, on every frame from Haifa's
 * photograph being lit until the fade must be over. */
async function fadeFrames(page) {
  const frames = page.evaluate(
    () =>
      new Promise((resolve) => {
        const host = document.getElementById("cityBackdrop");
        const read = () =>
          Object.fromEntries(
            [...host.querySelectorAll("img")].map((i) => [i.dataset.src, Number(getComputedStyle(i).opacity)])
          );
        const seen = [];
        new MutationObserver((_, observer) => {
          const lit = host.querySelector("img.is-on");
          if (!lit || lit.dataset.src !== "/planNG/cities/haifa.webp") return;
          observer.disconnect();
          const until = performance.now() + 900;
          const sample = () => {
            seen.push(read());
            if (performance.now() < until) requestAnimationFrame(sample);
            else resolve(seen);
          };
          sample();
        }).observe(host, { attributes: true, subtree: true, childList: true, attributeFilter: ["class"] });
      })
  );
  await page.click('.tl-item[data-festival="haifa-iff"]');
  return frames;
}

module.exports = {
  description: "choosing another festival fades its city's photograph in over the last one, and switches at once under reduced motion",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await unfreeze(page);

    const frames = await fadeFrames(page);
    await plannerReady(page, "haifa-iff");
    const first = frames[0];
    const last = frames[frames.length - 1];
    assert.ok(first[JERUSALEM] > 0, `Jerusalem's photograph is still showing as Haifa's is lit (${JSON.stringify(first)})`);
    assert.equal(last[JERUSALEM], 0, "Jerusalem's photograph has gone once the fade is over");
    assert.ok(last[HAIFA] > 0, "Haifa's photograph shows once the fade is over");
    assert.ok(
      frames.some((f) => f[HAIFA] > 0 && f[HAIFA] < last[HAIFA] && f[JERUSALEM] > 0),
      `part-way through, both photographs show, each part-faded: a cross-fade rather than a cut (${JSON.stringify(frames)})`
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await unfreeze(page);
    const still = await fadeFrames(page);
    assert.ok(
      still.every((f) => f[JERUSALEM] === 0 && f[HAIFA] === last[HAIFA]),
      `with reduced motion asked for, the photograph switches at once (${JSON.stringify(still)})`
    );
  },
};
