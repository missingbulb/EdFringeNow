"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The nine types and the year: Film chosen, only the film festivals stay;
 * chosen again, every type is back. */
module.exports = {
  description: "choosing a type's picture narrows the year to that type and offers its subtypes; choosing it again shows every type",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const region = () => t.unionClip([".tl-main", "#timelineTypes"], 6);
    const before = await region();
    await page.click('.tl-type[data-type="film"]');
    await page.mouse.move(0, 0);
    await settle(page);
    const picked = await region();
    await page.click('.tl-type[data-type="film"]');
    await page.mouse.move(0, 0);
    await settle(page);
    return t.animate([before, picked, await region()]);
  },
};
