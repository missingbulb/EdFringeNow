"use strict";
const { jerusalemReady, routeCrowdedYear } = require("../../shared/case-helpers");

/* Hundreds more festivals than the fixtures hold: the most searched take the
 * rows as bare bars and the rest lie faint behind them. */
module.exports = {
  description: "a crowded year: nameless bars on the rows, every other festival faint behind them in its type's colour",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page, { origin }) {
    await routeCrowdedYear(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
  },
  capture: ".tl-main",
};
