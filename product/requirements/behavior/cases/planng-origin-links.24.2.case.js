"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

const offered = (page) =>
  page.$$eval("#tripLinksRow .trip-link-text", (els) => els.map((e) => e.dataset.i18nSlot));

/* Each answer to "where are you coming from?", and the trip links it leaves:
 * none from the festival's own city, a bed and a train from elsewhere in the
 * country, the airport too from abroad. Asked once: the next festival chosen
 * does not ask again. */
module.exports = {
  description: "the answer decides the trip links, and is asked once across festivals",
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(await page.isVisible("#originCard"), true, "a first visit is asked");

    await page.click('#originCard [data-origin="city"]');
    assert.equal(await page.isVisible("#originCard"), false, "an answer puts the question away");
    assert.deepEqual(await offered(page), [], "the festival's own city: nothing to book");
    assert.equal(await page.isVisible("#tripLinksRow .trip-local"), true, "and the page says why");

    await page.click('#originLine [data-origin="change"]');
    await page.click('#originCard [data-origin="country"]');
    assert.deepEqual(await offered(page), ["trip.stay", "trip.rail"], "elsewhere in the country: a bed and a train");

    await page.click('#originLine [data-origin="change"]');
    await page.selectOption("#originCountry", "FR");
    assert.deepEqual(
      await offered(page),
      ["trip.stay", "trip.transfers", "trip.rail"],
      "abroad: a bed, the airport and the train"
    );
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("planNG.origin"))),
      { kind: "abroad", country: "FR" },
      "the answer is stored"
    );

    await page.click('.tl-item[data-festival="haifa-iff"]');
    await plannerReady(page, "haifa-iff");
    assert.equal(await page.isVisible("#originCard"), false, "the next festival does not ask again");
    assert.deepEqual(
      await offered(page),
      ["trip.stay", "trip.transfers", "trip.rail"],
      "and judges the same answer for its own city"
    );
  },
};
