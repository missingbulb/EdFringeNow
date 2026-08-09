"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "Clear asks before it wipes: idle, armed, cleared",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async capture(page, t) {
    // The button and the board it would throw away.
    const region = () => t.unionClip(["#clearFavBtn", ".lane >> nth=0"]);
    const idle = await region();
    await page.click("#clearFavBtn");
    await page.waitForTimeout(250);
    const armed = await region();
    await page.click("#clearFavBtn");
    await page.waitForSelector("#intakeStage .dropzone");
    await page.waitForTimeout(300);
    return t.animate([idle, armed, await t.element("#board")]);
  },
};
