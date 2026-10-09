"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* A trip at the very start of the year shown leaves no room before its first
 * day: that picture is left out, and the one after the last day still asks. */
module.exports = {
  description: "a travel picture with no room between its end of the trip and the strip's edge is left out, and the other still asks",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const shown = () =>
      page.$$eval(".tl-way", (els) => els.map((el) => [el.classList.contains("tl-way--from") ? "from" : "to", !el.hidden]));
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await plannerReady(page, "jerusalem-comedy");
    assert.deepEqual(await shown(), [["from", true], ["to", true]], "with room both sides, both show");

    await page.goto(`${origin}/planNG/?from=2026-07-02&to=2026-07-06&festival=jerusalem-comedy`, { waitUntil: "load" });
    await page.waitForSelector(".tl-way", { state: "attached" });
    assert.deepEqual(await shown(), [["from", false], ["to", true]], "no room before the first day: only the way home shows");
    await page.click(".tl-way--to");
    assert.equal(await page.isVisible("#originCountry"), true, "and it asks");
  },
};
