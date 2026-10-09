"use strict";
const { plannerReady } = require("../../shared/case-helpers");

const FIRST_CALENDAR_MS = 8000;
const REDRAFT_MS = 2000;
const MAX_ELEMENTS = 4000;

// The rows are the requirement: each budget, as verify() asserts it.
const TABLE = {
  columns: ["Measured", "Budget"],
  rows: [
    ["The first calendar, from navigation", `${FIRST_CALENDAR_MS / 1000} s`],
    ["A re-draft of the whole programme after one answer", `${REDRAFT_MS / 1000} s`],
    ["Elements on the page, the programme drafted", MAX_ELEMENTS.toLocaleString("en-GB")],
  ],
};

module.exports = {
  description: "focused on the whole Fringe, the page draws within its time budgets and stays a bounded page",
  table: TABLE,
  page: "/planNG/?festival=edfringe",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const started = Date.now();
    await page.goto(`${origin}/planNG/?festival=edfringe`, { waitUntil: "load" });
    await page.waitForSelector('html[data-festival="edfringe"] #schedule .sch-show', { timeout: 30000 });
    const firstCalendar = Date.now() - started;
    await plannerReady(page, "edfringe");

    const elements = await page.evaluate(() => document.getElementsByTagName("*").length);

    // One answer re-drafts the whole programme synchronously, inside the click.
    const redraft = await page.evaluate(() => {
      const target = [...document.querySelectorAll('[data-pick^="pace:"]')].find(
        (b) => b.getAttribute("aria-pressed") !== "true"
      );
      const t0 = performance.now();
      target.click();
      return Math.round(performance.now() - t0);
    });
    const afterRedraft = await page.evaluate(() => document.getElementsByTagName("*").length);

    // Written to the log so a slow run says by how much, not only that it was.
    console.log(`fringe scale: first calendar ${firstCalendar} ms, re-draft ${redraft} ms, ${elements} elements (${afterRedraft} after the re-draft)`);
    assert.ok(firstCalendar <= FIRST_CALENDAR_MS, `first calendar in ${firstCalendar} ms`);
    assert.ok(redraft <= REDRAFT_MS, `re-draft in ${redraft} ms`);
    assert.ok(elements <= MAX_ELEMENTS, `${elements} elements on the page`);
    assert.ok(afterRedraft <= MAX_ELEMENTS, `${afterRedraft} elements after a re-draft`);
  },
};
