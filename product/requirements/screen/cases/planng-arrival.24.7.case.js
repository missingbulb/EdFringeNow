"use strict";
const { jerusalemReady, routeFares, flightsSettled } = require("../../shared/case-helpers");

/* The way out, settled by each answer in turn: at home, driving, by train,
 * then flying from London. */
module.exports = {
  description: "each answer settles the blocks in its own picture: at home, driving, by train, flying",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeFares(page);
  },
  async capture(page, t) {
    const frames = [];
    const block = async () => t.clip(t.pad(await t.rectOf(".flight--out"), 2));
    for (const way of ["local", "drive", "train"]) {
      await page.click('.flight--out [data-origin="ask"], .flight--out [data-origin="change"]');
      await page.click(`#originCard [data-origin="${way}"]`);
      frames.push(await block());
    }
    await page.click('.flight--out [data-origin="change"]');
    await page.selectOption("#originCountry", "GB");
    await flightsSettled(page);
    frames.push(await block());
    return t.stitchV(frames);
  },
};
