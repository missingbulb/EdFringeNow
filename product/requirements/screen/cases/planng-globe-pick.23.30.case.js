"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The globe and the year beside it: the Middle East's badge chosen (its only
 * festival country, Israel, straight away), the globe zooms onto Israel and
 * offers its cities; Haifa chosen narrows the year to Haifa; the capsule over
 * the globe steps back out to Israel, then to the world. */
async function press(page, selector) {
  await page.click(selector);
  await page.mouse.move(0, 0);
  await settle(page);
}

module.exports = {
  description: "the globe offers areas, then countries, then cities, each a badge with its count; choosing one zooms onto it and the capsule over the globe steps back out",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const frames = [await t.element("#timeline")];
    await press(page, '.tl-badge[data-place="IL"]');
    frames.push(await t.element("#timeline"));
    await press(page, '.tl-badge[data-place="IL/Haifa"]');
    frames.push(await t.element("#timeline"));
    await press(page, ".tl-up");
    await press(page, ".tl-up");
    frames.push(await t.element("#timeline"));
    return t.animate(frames);
  },
};
