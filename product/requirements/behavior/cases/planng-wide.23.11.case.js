"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

const WIDE = { width: 2560, height: 1200 };
const GUTTER = 24;

/* Nothing on the page stops at a content width: at 2560 pixels the timeline,
 * the calendar card and the header all reach the side gutters. */
module.exports = {
  description: "on a wide screen the timeline and the calendar span the whole window",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.setViewportSize(WIDE);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const edges = await page.evaluate(() => {
      const box = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
      };
      return {
        page: document.documentElement.clientWidth,
        timeline: box("#timeline"),
        calendar: box("#planPanel"),
        wordmark: box(".site-header .logo"),
        controls: box(".chrome-prefs"),
      };
    });
    for (const part of ["timeline", "calendar"]) {
      assert.equal(edges[part].left, GUTTER, `the ${part} starts at the left gutter`);
      assert.equal(edges[part].right, edges.page - GUTTER, `the ${part} runs to the right gutter`);
    }
    assert.equal(edges.wordmark.left, GUTTER, "the wordmark sits on the left gutter");
    assert.equal(edges.controls.right, edges.page - GUTTER, "and the header's controls on the right one");
  },
};
