"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "picking a show commits it: intake hidden, plan strip rendered, panels closed",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    await page.click(".cta-trigger");
    await page.waitForTimeout(500);
    await page.click('.show-pick:has-text("Masala")');
    await page.waitForSelector("#journeyStrip .plan-node");
    assert.ok(await page.locator("body.has-plan").count() === 1, "body gains has-plan");
    assert.ok(await page.locator(".cta-intake").isHidden(), "intake hidden");
    assert.ok(await page.locator("#constraintPanel").isHidden(), "panel closed");
    assert.ok((await page.textContent("#journeyStrip")).includes("Your next commitment"));
  },
};
