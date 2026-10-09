"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* Every question answered, the day's end moved, then a reload: what comes back
 * is the whole of what was said, under this page's own storage prefix. */
module.exports = {
  description: "every preference survives a reload, and never reaches the Edinburgh planner's stored list",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    await page.click("[data-open='interests']");
    await page.click("[data-pick='interest:comedy']");
    await page.click("[data-tag='jerusalem-comedy/stand-up']");
    await page.click("[data-open='travel']");
    await page.click("[data-pick='travel:bike']");
    await page.click("[data-open='pace']");
    await page.selectOption(".pref[data-q='pace'] [data-num='minGap']", "45");
    await page.click("[data-open='food']");
    await page.click("[data-pick='food:regular']");
    await page.fill(".pref-place[data-place='dinner']", "Machneyuda");
    await page.locator(".pref-place[data-place='dinner']").blur();
    await page.keyboard.press("Escape");

    // The day's end, by keyboard: a quarter of an hour earlier.
    await page.locator(".sch-dayline--end").focus();
    await page.keyboard.press("ArrowUp");
    await jerusalemReady(page);

    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.prefs")));
    assert.deepEqual(before.interests, ["comedy"], "the kind named is stored");
    assert.deepEqual(before.tags, { "jerusalem-comedy/stand-up": "only" }, "the tag required is stored");
    assert.equal(before.mode, "bike", "the way around is stored");
    assert.equal(before.minGap, 45, "the exact number behind the picture is stored");
    assert.equal(before.dayEndMin, 25 * 60 - 15, "the day's end is stored where it was dragged to");
    assert.deepEqual(
      before.meals.map((m) => [m.id, m.enabled, m.place]),
      [["breakfast", true, ""], ["lunch", true, ""], ["dinner", true, "Machneyuda"]],
      "every meal, and the place named for one of them, is stored"
    );

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);

    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.prefs"))),
      before,
      "the same answers come back"
    );
    assert.equal(
      await page.getAttribute("[data-pick='interest:comedy']", "aria-pressed"),
      "true",
      "the kind named is lit again"
    );
    assert.equal(
      await page.inputValue(".pref-place[data-place='dinner']"),
      "Machneyuda",
      "the place named comes back in the question"
    );
    assert.equal(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("edfringe.")).length
      ),
      0,
      "the Edinburgh planner's own keys are untouched"
    );
  },
};
