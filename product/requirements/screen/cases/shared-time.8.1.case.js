"use strict";
const { nowStorage, nowReady, planFavourites, planReady } = require("../../shared/case-helpers");

module.exports = {
  description: "both pages run the festival day to 06:00",
  viewport: "desktop",
  localStorage: { ...nowStorage(), ...planFavourites() },
  // One picture, both pages: the Now page's wheel at the day's last slot, and
  // the planner's schedule counting on past midnight.
  async capture(page, t) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      for (const id of ["hourWheel", "minWheel"]) {
        const el = document.getElementById(id);
        el.scrollTop = el.scrollHeight;
      }
    });
    await page.waitForTimeout(600);
    const nowWheel = await t.element(".wheel-time");

    await page.goto(`${page.url().split("/").slice(0, 3).join("/")}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector(".sch-show");
    // The gutter's late hours: 24:00 onwards, where a wrapping clock would
    // have restarted at 00:00.
    const late = await t.rectOf(".sch-hour--late");
    const axis = await t.rectOf("#schedule");
    const planLate = await t.clip({ x: axis.x, y: late.y - 40, width: 220, height: 150 });

    return t.stitchV([nowWheel, planLate]);
  },
};
