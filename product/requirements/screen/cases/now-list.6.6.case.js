"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "card prices are exact: Free, £N, and Price TBC for an unknown",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    // Reveal the whole list so the Free and Price TBC cards are both on it.
    const more = page.locator("#showMore");
    while (await more.isVisible()) await more.click();
    await page.waitForTimeout(300);
  },
};
