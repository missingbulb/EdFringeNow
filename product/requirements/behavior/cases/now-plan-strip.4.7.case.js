"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "dest × clears the commitment but keeps the selected show; stop × clears just the show",
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
    await page.waitForSelector("#journeyStrip .plan-node.stop");

    // Remove the slipped-in show: the stop goes, the commitment stays.
    await page.click('#journeyStrip .plan-node.stop [data-act="remove"]');
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#journeyStrip .plan-node.stop").count(), 0, "stop removed");
    assert.ok(await page.locator("#journeyStrip .plan-node.dest").count() > 0, "commitment kept");

    // Re-select, then remove the commitment: the selected show survives.
    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForSelector("#journeyStrip .plan-node.stop");
    await page.click('#journeyStrip .plan-node.dest [data-act="remove"]');
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#journeyStrip .plan-node.dest").count(), 0, "commitment removed");
    assert.ok(await page.locator(".show-item--leg").count() > 0, "selected show kept");
  },
};
