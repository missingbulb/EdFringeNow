"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "a reader who said they come from the United Kingdom sees each break its bank holidays make as a green orb on the months",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { "planNG.origin": JSON.stringify({ kind: "abroad", country: "GB", arrive: "fly" }) },
  ready: async (page) => {
    await jerusalemReady(page);
    await page.waitForSelector(".tl-orb");
  },
  capture: (page, t) => t.unionClip([".tl-months", ".tl-sign"]),
};
