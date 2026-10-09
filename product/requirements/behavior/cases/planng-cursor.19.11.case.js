"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* Every element's computed cursor, read at rest and again while the pointer
 * rests on each of the places that used to change it, against the cursor the
 * browser gives that same element with the page's own stylesheets switched
 * off: the hand on a link, the arrow on a button, auto elsewhere. */
const HOVERED = [".tl-handle--from", ".sch-body", ".sch-show"];

const changed = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll("*")];
    const styled = els.map((el) => getComputedStyle(el).cursor);
    const sheets = [...document.styleSheets];
    for (const sheet of sheets) sheet.disabled = true;
    const own = els.map((el) => getComputedStyle(el).cursor);
    for (const sheet of sheets) sheet.disabled = false;
    return els
      .map((el, i) => [el, styled[i], own[i]])
      .filter(([, cursor, browsers]) => cursor !== browsers)
      .map(([el, cursor, browsers]) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}: ${cursor}, not ${browsers}`);
  });

module.exports = {
  description: "the planner never changes the mouse cursor",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    assert.deepEqual(await changed(page), [], "no element sets a cursor");
    for (const sel of HOVERED) {
      await page.hover(`${sel} >> nth=0`);
      assert.deepEqual(await changed(page), [], `nor while the pointer rests on ${sel}`);
    }
  },
};
