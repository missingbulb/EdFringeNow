"use strict";
const { plan2Ready } = require("../../shared/case-helpers");
const { plan2Storage } = require("../../shared/plan2-fixture");

module.exports = {
  description: "a half-answered question reopened from the draft comes back before the calendar",
  localStorage: plan2Storage("draft"),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan2/`, { waitUntil: "load" });
    await plan2Ready(page);
    assert.equal(await page.locator(".daycol").count(), 5, "the finished draft has its five day columns");
    // Reopen "When?", start a new range with one click, hop away, and march to the end.
    await page.click('[data-reopen="when"]');
    await page.click('[data-day="2026-08-20"]');
    await page.click('[data-reopen="who"]');
    for (let i = 0; i < 5; i++) {
      const next = page.locator('[data-nav="next"]:not([disabled])');
      if (!(await next.count())) break;
      await next.click();
    }
    assert.equal(await page.locator(".qcard.current h2").textContent(), "When?", "the half-answered question is back");
    assert.equal(await page.locator(".daycol").count(), 0, "no calendar was drawn");
    // Complete the range: the draft returns with its columns.
    await page.click('[data-day="2026-08-23"]');
    for (let i = 0; i < 6; i++) {
      const next = page.locator('[data-nav="next"]:not([disabled])');
      if (!(await next.count())) break;
      await next.click();
    }
    assert.equal(await page.locator(".daycol").count(), 4, "20–23 Aug draws four day columns");
  },
};
