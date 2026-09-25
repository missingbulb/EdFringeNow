"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* A family with a five-year-old, the pace then answered by hand, then a
 * switch to a couple, then a reload. */
module.exports = {
  description: "who's coming fills in the questions not yet answered, marked as suggested; an answer you gave stays",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const lit = (q) => page.getAttribute(`.pref[data-q='${q}'] .pref-pick[aria-pressed='true']`, "data-pick");
    const suggested = () =>
      page.$$eval(".pref.is-suggested", (els) => els.map((el) => el.dataset.q).sort());
    const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem("planNG.prefs")));

    await page.click("[data-open='who']");
    await page.click("[data-pick='who:family']");
    await page.click("[data-age='5']");
    await page.keyboard.press("Escape");
    await settle(page);
    assert.equal(await lit("pace"), "pace:easy", "a family with a five-year-old takes it easy");
    assert.equal(await lit("food"), "food:regular", "and eats three meals");
    assert.deepEqual((await prefs()).interests, ["family"], "and favours family shows");
    assert.equal((await prefs()).dayEndMin, 21 * 60, "and ends the evening at 21:00");
    assert.deepEqual(await suggested(), ["food", "interests", "pace"], "each filled-in chip says it is a suggestion");

    await page.click("[data-open='pace']");
    await page.click("[data-pick='pace:packed']");
    await page.keyboard.press("Escape");
    await page.click("[data-open='who']");
    await page.click("[data-pick='who:couple']");
    await page.keyboard.press("Escape");
    await settle(page);
    assert.equal(await lit("pace"), "pace:packed", "the pace answered by hand stays");
    assert.equal(await lit("food"), "food:dinner", "the meals follow the couple");
    assert.equal((await prefs()).dayEndMin, 25 * 60, "and so does the evening");
    assert.deepEqual(await suggested(), ["food", "interests"], "the pace is no longer a suggestion");

    const before = await prefs();
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    assert.deepEqual(await prefs(), before, "the same answers come back");
    assert.deepEqual(await suggested(), ["food", "interests"], "with the same marks");
  },
};
