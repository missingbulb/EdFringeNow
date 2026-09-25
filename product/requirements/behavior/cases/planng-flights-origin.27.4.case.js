"use strict";
const { jerusalemReady, flightsSettled } = require("../../shared/case-helpers");

/* Flying in, the blocks ask for an airport — the country's filled in,
 * anywhere else left to type — and either block changes the answer. */
module.exports = {
  description: "flying in, the flight blocks ask for your airport, a country named filling in its main one, and either block changes how you are getting here",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const out = (sel) => page.locator(`.flight--out ${sel}`);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await out('[data-origin="ask"]').click();
    await page.click('#originCard [data-origin="drive"]');
    assert.equal(await page.locator("#flightFrom").count(), 0, "driving: no airport to ask for");

    await page.click('.flight--back [data-origin="change"]');
    assert.equal(await page.isVisible("#originCard"), true, "either block's change asks the question again");

    await page.selectOption("#originCountry", "*");
    await flightsSettled(page);
    assert.equal(await page.inputValue("#flightFrom"), "", "somewhere else abroad: the airport is the reader's to type");
    assert.match(await out(".flight-note").textContent(), /airport's code/);

    await page.fill("#flightFrom", "bcn");
    await page.dispatchEvent("#flightFrom", "change");
    await flightsSettled(page);
    assert.equal(await page.inputValue("#flightFrom"), "BCN", "a typed code is kept, as a code");
    assert.equal(await page.locator(".flight--back .flight-code").last().textContent(), "BCN", "and flown home to");

    await page.click('.flight--out [data-origin="change"]');
    await page.selectOption("#originCountry", "FR");
    await flightsSettled(page);
    assert.equal(await page.inputValue("#flightFrom"), "PAR", "a country named fills in its main airport");
  },
};
