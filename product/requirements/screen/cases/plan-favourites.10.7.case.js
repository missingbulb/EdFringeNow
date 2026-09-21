"use strict";
const { planFavourites, settle } = require("../../shared/case-helpers");

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
    await settle(page);
    const armed = await region();
    await page.click("#clearFavBtn");
    await page.waitForSelector("#intakeStage .dropzone");
    await settle(page);
    return t.animate([idle, armed, await t.element("#board")]);
  },
};
