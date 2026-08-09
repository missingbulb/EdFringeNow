"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "picking a show commits it: intake hidden, plan strip rendered, panels closed",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    await page.click(".cta-trigger");
    await page.waitForSelector("#constraintPanel:not([hidden])");
    await page.waitForTimeout(400); // the wheels sync on the next frame
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    assert.ok(await page.locator("body.has-plan").count() === 1, "body gains has-plan");
    assert.ok(await page.locator(".cta-intake").isHidden(), "intake hidden");
    assert.ok(await page.locator("#constraintPanel").isHidden(), "panel closed");
    assert.ok((await page.textContent("#journeyStrip")).includes("Your next commitment"));
  },
};
