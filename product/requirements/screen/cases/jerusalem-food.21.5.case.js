"use strict";
const { jerusalemAllDays, jerusalemMeals, jerusalemPrefs, jerusalemReady, settle } = require("../../shared/case-helpers");

// Two nights, twice: once with all three meals asked for — one of them with a
// place named — and once with food left to the reader, which draws nothing.
const NIGHTS = ['.sch-day[data-date="2026-10-19"]', '.sch-day[data-date="2026-10-20"]'];

module.exports = {
  description:
    "a meal asked for is a band the calendar drafts around; sorting food out yourself leaves the day clear",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { ...jerusalemPrefs({ meals: jerusalemMeals({ dinner: "Machneyuda" }) }), ...jerusalemAllDays() },
  ready: jerusalemReady,
  async capture(page, t) {
    const frame = async () => t.clip(t.pad(t.union(await Promise.all(NIGHTS.map((n) => t.rectOf(n)))), 6));
    const withMeals = await frame();
    await page.click("[data-open='food']");
    await page.click("[data-pick='food:self']");
    await page.keyboard.press("Escape");
    await jerusalemReady(page);
    await settle(page);
    return t.stitchV([withMeals, await frame()]);
  },
};
