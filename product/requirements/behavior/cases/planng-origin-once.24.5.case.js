"use strict";
const { jerusalemReady, plannerReady, answerTravel } = require("../../shared/case-helpers");

/* Asked once per browser: an answer puts the question away, is stored, and
 * the next festival chosen does not ask again. */
module.exports = {
  description: "the origin question is asked once, and not again on the next festival",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(await page.isVisible("#originCard"), false, "a first visit is not asked until it looks at the way there");
    await page.click(".tl-way--from");
    assert.equal(await page.isVisible("#originCard"), true, "and is asked then");
    await page.click('#originCard [data-origin="skip"]');

    await answerTravel(page, { home: "FR", way: "fly" });
    assert.equal(await page.locator("#originCountry").count(), 0, "an answer puts the question away");
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.origin"))),
      { kind: "abroad", country: "FR", arrive: "fly" },
      "the answer is stored"
    );

    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    assert.equal(await page.locator("#originCountry").count(), 0, "the next festival does not ask again");
    assert.equal(await page.locator(".tl-way .arrive-icons").count(), 0, "its pictures are settled too");
  },
};
