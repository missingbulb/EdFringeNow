"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the buy-ahead link targets edfringe.com/tickets/whats-on/<slug> in a new tab",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    await page.click('.show-item:has-text("A Good Time Charlie")');
    const link = page.locator(".plan-buy-inline");
    await link.waitFor();
    assert.equal(
      await link.getAttribute("href"),
      "https://www.edfringe.com/tickets/whats-on/a-good-time-charlie"
    );
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.ok((await link.getAttribute("rel")).includes("noopener"));
  },
};
