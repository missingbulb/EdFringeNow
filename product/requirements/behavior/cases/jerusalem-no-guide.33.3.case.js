"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "a city with no lists yet shows no drawer and no credit for them",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  failData: ["/data/cities/"],
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.waitForSelector('#cityGuide[data-state="absent"]', { state: "attached", timeout: 20000 });
    assert.equal(await page.isVisible("#cityGuide"), false, "no drawer for the city");
    const footer = await page.textContent(".footer-copy");
    assert.doesNotMatch(footer, /OpenStreetMap|Wikivoyage/, "and no credit for lists that are not there");
    assert.ok(await page.isVisible(".sch-show"), "the calendar is drawn as ever");
  },
};
