"use strict";
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "clicking a conflict pill jumps to the culpable setting and flashes it",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector("#calWrap:not([hidden])");
    // The flash class is stripped again on animationend (instant under the
    // frozen-animation harness) — record its appearance with an observer.
    await page.evaluate(() => {
      window.__flashed = [];
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.target.classList && m.target.classList.contains("ctl--flash")) {
            window.__flashed.push(Boolean(m.target.querySelector("#mealLunchStart")));
          }
        }
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    await page.click('.lane-status button:has-text("Lunch conflict")');
    await page.waitForTimeout(600);
    const flashed = await page.evaluate(() => window.__flashed);
    assert.ok(flashed.length > 0, "a control flashed");
    assert.ok(flashed.includes(true), "the lunch control was among the flashed");
    // And the strip scrolled into view.
    assert.ok(
      await page.evaluate(() => {
        const r = document.getElementById("mealLunchStart").getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      }),
      "the control is on screen"
    );
  },
};
