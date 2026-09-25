"use strict";
const { jerusalemReady, plannerReady } = require("../../shared/case-helpers");

/* The top of the page as each festival comes to lead the trip, one frame per
 * host city: the photograph behind the year and the page's name changes with
 * it. The header is left out: it is the site's, and no photograph is behind it. */
const TOP = [".timeline", ".page-head"];
const NEXT = ["haifa-iff", "acco", "edfringe"];

module.exports = {
  description: "each host city's faded photograph behind the top of the page: Jerusalem, Haifa, Akko, then Edinburgh",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const frames = [await t.unionClip(TOP, 12)];
    for (const id of NEXT) {
      await page.click(`.tl-item[data-festival="${id}"]`);
      await plannerReady(page, id);
      await page.evaluate(() => window.scrollTo(0, 0));
      frames.push(await t.unionClip(TOP, 12));
    }
    return t.animate(frames);
  },
};
