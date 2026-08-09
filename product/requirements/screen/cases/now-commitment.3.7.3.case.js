"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "the wheel ends at 29:55, shown as 05:55",
  capture: ".wheel-time",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400);
    // Scroll both wheels to their last slot; the app reads a wheel's value a
    // moment after the scrolling stops, so settle before capturing.
    await page.evaluate(() => {
      for (const id of ["hourWheel", "minWheel"]) {
        const el = document.getElementById(id);
        el.scrollTop = el.scrollHeight;
      }
    });
    await page.waitForTimeout(600);
  },
};
