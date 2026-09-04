"use strict";
const { plan2Ready, settle } = require("../../shared/case-helpers");
const { plan2Storage } = require("../../shared/plan2-fixture");

// Two peels, side by side: a repeating show's five correction stickers, then
// a one-off's single "Not for me". Each is captured as the ticket plus the
// sheet it reveals; the golden is the two crops stitched.
async function peel(page, tools, selector) {
  await page.click(selector);
  await settle(page);
  return tools.unionClip([`${selector}.lift`, ".reveal"], 12);
}

module.exports = {
  description: "peeling a ticket reveals the correction stickers; a one-off reveals only Not for me",
  page: "/plan2/",
  viewport: "desktop",
  localStorage: plan2Storage("draft"),
  ready: plan2Ready,
  capture: async (page, tools) => {
    const repeating = await peel(page, tools, '.tix[data-kind="show"]:not([data-oneoff])');
    const oneOff = await peel(page, tools, '.tix[data-oneoff]');
    return tools.stitchH([repeating, oneOff], 24);
  },
};
