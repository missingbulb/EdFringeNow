"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

module.exports = {
  description: "getting here: the paid airport transfer, and the train offered beside it",
  page: "/planNG/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await jerusalemReady(page);

    const links = page.locator(".trip-link");
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    const partners = await links.evaluateAll((els) =>
      els.map((e) => e.querySelector(".trip-link-partner").textContent)
    );

    assert.deepEqual(partners.slice(1), ["Kiwitaxi", "Israel Railways"]);
    assert.equal(hrefs[1], "https://kiwitaxi.com/en/israel/ben-gurion-airport");
    // Untagged, and it must stay that way: Israel Railways runs no referral
    // programme, and the train is offered anyway because it is usually the
    // right answer from the airport.
    assert.equal(hrefs[2], "https://www.rail.co.il/en");
  },
};
