"use strict";
const { jerusalemReady, routeFares, flightsSettled, settle } = require("../../shared/case-helpers");

/* The fare service counted through every answer: nothing until flying. */
module.exports = {
  description: "no fare is asked for until you have said you are flying",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const asked = await routeFares(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await settle(page);
    assert.equal(asked.length, 0, "unsettled: no fare asked for");

    for (const way of ["local", "drive", "train"]) {
      await page.click('.flight--out [data-origin="ask"], .flight--out [data-origin="change"]');
      await page.click(`#originCard [data-origin="${way}"]`);
      await settle(page);
      assert.equal(asked.length, 0, `${way}: no fare asked for`);
    }

    await page.click('.flight--out [data-origin="change"]');
    await page.selectOption("#originCountry", "GB");
    await flightsSettled(page);
    assert.equal(asked.length, 2, "flying: the way out and the way home");
  },
};
