"use strict";
const { jerusalemReady, routeWhere } = require("../../shared/case-helpers");

/* No answer yet: the holidays are the connection's country's, said to be a
 * guess; the reader's answer from the flight blocks replaces it. */
const marks = (page) =>
  page.$$eval("#timelineYear .tl-holiday", (els) => els.map((e) => ({ day: e.dataset.day, name: e.getAttribute("title") })));

module.exports = {
  description: "until you say where you come from, the holidays are those of the country you connect from, marked as a guess, and your answer replaces them",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await routeWhere(page, "IL");
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.waitForSelector("#timelineYear .tl-holiday");

    const guessed = await marks(page);
    const yomKippur = guessed.find((m) => m.day === "2026-09-21");
    assert.ok(yomKippur, "Israel's holidays are marked, Yom Kippur among them");
    assert.match(yomKippur.name, /Yom Kippur/, "each mark is named");
    assert.match(await page.textContent("#holidayNote"), /Israel.*guess/, "and the strip says they are a guess");

    await page.click('.flight--out [data-origin="ask"]');
    await page.selectOption("#originCountry", "GB");
    await page.waitForFunction(() => document.querySelector('#timelineYear .tl-holiday[data-day="2026-12-25"]'));
    const said = await marks(page);
    assert.equal(said.find((m) => m.day === "2026-09-21"), undefined, "the answer replaces the guess");
    assert.match(await page.textContent("#holidayNote"), /United Kingdom/);
    assert.doesNotMatch(await page.textContent("#holidayNote"), /guess/, "and it is no longer called one");
  },
};
