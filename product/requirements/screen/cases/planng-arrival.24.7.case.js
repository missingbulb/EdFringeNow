"use strict";
const { jerusalemReady, routeFares, flightsSettled, answerTravel } = require("../../shared/case-helpers");

/* The pictures either side of the trip, settled by each answer in turn: living
 * there, driving from elsewhere in Israel, by train, then flying from London. */
module.exports = {
  description: "each answer settles both travel pictures in its own picture: living there, driving, by train, flying",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeFares(page);
  },
  async capture(page, t) {
    const frames = [];
    const strip = async () => t.clip(t.pad(t.union([await t.rectOf(".tl-way--from"), await t.rectOf(".tl-way--to")]), 4));
    const close = () => page.click('#originCard [data-origin="skip"]').catch(() => {});
    await answerTravel(page, { home: "local" });
    frames.push(await strip());
    await answerTravel(page, { home: "IL", way: "drive" });
    frames.push(await strip());
    await answerTravel(page, { home: "IL", way: "train" });
    frames.push(await strip());
    await answerTravel(page, { home: "GB", way: "fly" });
    await flightsSettled(page);
    await close();
    // Off the fare, whose own label would otherwise open over the picture.
    await page.mouse.move(0, 0);
    frames.push(await strip());
    return t.stitchV(frames);
  },
};
