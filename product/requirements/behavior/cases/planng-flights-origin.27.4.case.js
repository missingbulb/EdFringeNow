"use strict";
const { jerusalemReady, flightsSettled } = require("../../shared/case-helpers");

/* What the blocks offer follows the origin answer: unsaid they offer the
 * question, at home they need no flight, abroad they ask for an airport — the
 * country's filled in, anywhere else left to type — and each can be changed. */
module.exports = {
  description: "the flight blocks follow where you are coming from: an airport to fly from abroad, no flight at home, and a way to change the answer",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const out = (sel) => page.locator(`.flight--out ${sel}`);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.match(await out('[data-origin="ask"]').textContent(), /where you're coming from/, "unsaid: the blocks offer the question");
    await out('[data-origin="ask"]').click();
    assert.equal(await page.isVisible("#originCard"), true, "which opens when asked for");

    await page.click('[data-origin="city"]');
    assert.match(await out(".flight-note").textContent(), /No flight needed from Jerusalem/, "at home: no flight");
    assert.equal(await page.locator("#flightFrom").count(), 0, "and no airport to ask for");

    await page.click('.flight--out [data-origin="change"]');
    assert.equal(await page.isVisible("#originCard"), true, "change asks the question again");

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
