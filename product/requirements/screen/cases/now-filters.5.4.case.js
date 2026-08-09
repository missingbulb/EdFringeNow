"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "travel panel: three modes with speeds, the 1–60 minute slider, '10 min max'",
  capture: "#travelPanel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="travelPanel"]');
    await page.waitForSelector("#travelOptions label");
    await page.waitForTimeout(200);
  },
};
