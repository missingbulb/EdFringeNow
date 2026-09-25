"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The harness lands every animation on its end state at once; this wraps that
 * stub to record what the calendar asked to animate, and on which block. The
 * day's end is moved earlier (shows leave) and back (shows come back). */
const RECORD = `
  window.__motion = [];
  const landed = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    if (this.closest && this.closest("#scheduleWrap")) {
      const first = Array.isArray(keyframes) ? keyframes[0] : keyframes;
      window.__motion.push({
        what: this.classList.contains("sch-ghost") ? "leave" : this.classList.contains("sch-day") ? "width" : "block",
        from: JSON.stringify(first),
      });
    }
    return landed.call(this, keyframes, options);
  };
`;

async function moveDayEnd(page) {
  const line = page.locator(".sch-dayline--end");
  await line.focus();
  await page.evaluate(() => (window.__motion = []));
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
  const out = await page.evaluate(() => window.__motion);
  await page.evaluate(() => (window.__motion = []));
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
  const back = await page.evaluate(() => window.__motion);
  return { out, back };
}

module.exports = {
  description: "shows the calendar gains or loses fade in or out, and the ones that move slide",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.addInitScript(RECORD);
    await page.goto(`${origin}/planNG/?festival=haifa-iff`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    const { out, back } = await moveDayEnd(page);
    assert.ok(
      out.some((m) => m.what === "leave" && /"opacity":1/.test(m.from)),
      "a show the earlier day's end drops is drawn where it stood and fades away"
    );
    assert.ok(
      back.some((m) => m.what === "block" && /"opacity":0/.test(m.from)),
      "a show the later day's end brings back grows in from nothing"
    );
    assert.ok(
      [...out, ...back].some((m) => m.what === "block" && /translate/.test(m.from)),
      "a show that moves slides from where it was"
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    const still = await moveDayEnd(page);
    assert.deepEqual([...still.out, ...still.back], [], "asked for reduced motion, nothing on the calendar moves");
  },
};
