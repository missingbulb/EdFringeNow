"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The day's end moved a long way earlier and back, and its start later: the
 * calendar's height never moves. Then the night is opened, and a reload keeps
 * it open. */
const height = (page) => page.$eval("#schedule .sch-gutter-body", (el) => el.getBoundingClientRect().height);

async function press(page, which, key, times) {
  const line = page.locator(`.sch-dayline--${which}`);
  await line.focus();
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

module.exports = {
  description: "moving the day's start or end never changes the calendar's height; the night's fold is kept",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=haifa-iff`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    const folded = await height(page);
    await press(page, "end", "ArrowUp", 24);
    assert.equal(await height(page), folded, "an earlier day's end leaves the height alone");
    await press(page, "start", "ArrowDown", 16);
    assert.equal(await height(page), folded, "a later day's start leaves the height alone");

    await page.click("[data-night]");
    const open = await height(page);
    assert.ok(open > folded, "opening the night adds its hours");
    await page.reload({ waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    assert.equal(await height(page), open, "the night is still open after a reload");
    assert.equal(await page.getAttribute("[data-night]", "aria-expanded"), "true");
  },
};
