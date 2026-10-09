"use strict";
const { jerusalemReady, flightsSettled, answerTravel } = require("../../shared/case-helpers");

/* Flying in, the travel card asks for an airport — the country lived in
 * filled in, anywhere else left to type — and changes the answer. */
module.exports = {
  description: "flying in, the travel card asks for your airport, the country you live in filling in its main one, and can change how you are getting here",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const out = (sel) => page.locator(`.flight--out ${sel}`);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await answerTravel(page, { home: "IL", way: "drive" });
    await page.click(".tl-way--to");
    assert.equal(await page.locator("#flightFrom").count(), 0, "driving: no airport to ask for");

    await page.click('#originCard [data-origin="change"]');
    assert.equal(await page.isVisible("#originCountry"), true, "the card's change asks the question again");

    await page.selectOption("#originCountry", "*");
    await page.click('#originCard [data-origin="next"]');
    await page.click('#originCard [data-origin="fly"]');
    await flightsSettled(page);
    assert.equal(await page.inputValue("#flightFrom"), "", "somewhere else abroad: the airport is the reader's to type");
    assert.match(await out(".flight-note").textContent(), /airport's code/);

    await page.fill("#flightFrom", "bcn");
    await page.dispatchEvent("#flightFrom", "change");
    await flightsSettled(page);
    assert.equal(await page.inputValue("#flightFrom"), "BCN", "a typed code is kept, as a code");
    assert.equal(await page.locator(".flight--back .flight-code").last().textContent(), "BCN", "and flown home to");

    await answerTravel(page, { home: "FR", way: "fly" });
    await flightsSettled(page);
    assert.equal(await page.inputValue("#flightFrom"), "PAR", "a country named fills in its main airport");
  },
};
