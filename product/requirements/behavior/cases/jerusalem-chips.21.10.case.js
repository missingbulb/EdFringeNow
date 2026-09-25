"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* Every chip opened in turn, and an answer given in the longest panel: the
 * calendar's top edge is where it was each time. */
module.exports = {
  description: "opening a chip, or answering in it, leaves the calendar where it was",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    const top = () => page.evaluate(() => document.getElementById("scheduleWrap").getBoundingClientRect().top + scrollY);
    const before = await top();

    for (const chip of await page.$$eval("[data-open]", (els) => els.map((el) => el.dataset.open))) {
      await page.click(`[data-open='${chip}']`);
      await settle(page);
      assert.equal(await page.isVisible(`#panel-${chip}`), true, `${chip}: its panel opens`);
      assert.equal(await top(), before, `${chip}: the calendar has not moved`);
    }

    await page.click("[data-open='interests']");
    await page.click("[data-pick='interest:comedy']");
    await settle(page);
    assert.equal(await page.isVisible("#panel-interests"), true, "the panel stays open on an answer");
    assert.equal(await top(), before, "answering leaves the calendar where it was");

    await page.keyboard.press("Escape");
    assert.equal(await page.isVisible("#panel-interests"), false, "Escape puts the panel away");
  },
};
