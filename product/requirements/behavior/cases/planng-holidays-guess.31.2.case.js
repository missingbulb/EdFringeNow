"use strict";
const { jerusalemReady, routeWhere, answerTravel } = require("../../shared/case-helpers");

/* No answer yet: the holidays are the connection's country's, said to be a
 * guess; the reader's answer from the travel blocks replaces it. */
const orbs = (page) =>
  page.$$eval("#timelineYear .tl-orb", (els) => els.map((e) => ({ from: e.dataset.from, to: e.dataset.to, name: e.getAttribute("aria-label") })));
const covering = (list, day) => list.find((o) => o.from <= day && day <= o.to);
const cardOf = async (page, day) => {
  const all = await orbs(page);
  const orb = covering(all, day);
  await page.hover(`.tl-orb[data-from="${orb.from}"]`);
  await page.waitForSelector(".tl-card:not([hidden])");
  return page.textContent(".tl-card");
};

module.exports = {
  description: "until you say where you come from, the holidays are those of the country you connect from, marked as a guess, and your answer replaces them",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await routeWhere(page, "IL");
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.waitForSelector("#timelineYear .tl-orb");

    const yomKippur = covering(await orbs(page), "2026-09-21");
    assert.ok(yomKippur, "Israel's holidays are marked, Yom Kippur among them");
    assert.match(yomKippur.name, /Yom Kippur/, "each orb is named");
    assert.match(await cardOf(page, "2026-09-21"), /Israel.*guess/, "and its card says they are a guess");

    await answerTravel(page, { home: "GB", way: "fly" });
    await page.waitForFunction(() => document.querySelector('#timelineYear .tl-orb[data-from="2026-12-25"]'));
    assert.equal(covering(await orbs(page), "2026-09-21"), undefined, "the answer replaces the guess");
    const card = await cardOf(page, "2026-12-25");
    assert.match(card, /United Kingdom/);
    assert.doesNotMatch(card, /guess/, "and it is no longer called one");
  },
};
