"use strict";
const { nowStorage } = require("../../shared/case-helpers");

module.exports = {
  description: "subgenre panel: only the subgenres the other filters leave, with counts",
  capture: "#subgenrePanel",
  localStorage: nowStorage(),
  async drive(page) {
    await page.click('[data-panel="subgenrePanel"]');
    await page.waitForSelector("#subgenreOptions label, #subgenreOptions .panel-note");
    await page.waitForTimeout(200);
  },
};
