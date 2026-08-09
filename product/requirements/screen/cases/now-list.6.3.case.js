"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "Soonest re-orders the list under HH:MM group headings",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click('.view-btn[data-mode="soonest"]');
    await page.waitForSelector(".shows-group-head");
    await page.waitForTimeout(300);
  },
};
