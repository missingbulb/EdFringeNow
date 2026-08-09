"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "debug pill hidden for in-UK; shown with the simulated moment only out of the UK",
  localStorage: nowStorage(),
  async verify(page, { origin, assert, context }) {
    // In-UK (the default fake): pill hidden, real (fixed) clock adopted.
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    assert.ok(await page.locator("#debugMenu").isHidden(), "pill hidden for an in-UK visitor");

    // Out-of-UK: pill visible, simulated clock kept.
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 }); // Paris
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#debugMenu:not([hidden])", { timeout: 20000 });
    await page.click("#debugToggle");
    assert.equal((await page.textContent("#debugNowText")).trim(), "Fri 14 Aug, 15:44 BST");
    assert.equal(await page.textContent("#debugToggle"), "debug v0.0.0-spec");
  },
};
