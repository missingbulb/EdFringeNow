"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* Living in France: the second question, how you travel. */
module.exports = {
  description: "living elsewhere, the next question is how you travel: fly, the train or drive",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await page.click(".tl-way--from");
    await page.selectOption("#originCountry", "FR");
    await page.click('#originCard [data-origin="next"]');
    await page.waitForSelector('#originCard [data-origin="fly"]');
  },
  capture: "#originCard",
};
