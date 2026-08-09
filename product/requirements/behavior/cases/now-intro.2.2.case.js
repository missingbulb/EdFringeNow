"use strict";
const { nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "dismissing the explainer hides it and is remembered across reloads",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    assert.ok(await page.locator("#intro").isVisible(), "first visit shows the intro");
    await page.click("#introGot");
    assert.ok(await page.locator("#intro").isHidden(), "dismissed on click");
    await page.reload({ waitUntil: "load" });
    await nowReady(page);
    assert.ok(await page.locator("#intro").isHidden(), "still hidden after a reload");
  },
};
