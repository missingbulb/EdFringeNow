"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "tapping a card slips the show into the plan; tapping again takes it out",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".show-item--leg").count(), 1, "card marked as the pick");
    assert.ok((await page.textContent("#journeyStrip")).includes("A Good Time Charlie"));
    await page.click('.show-item:has-text("A Good Time Charlie")');
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".show-item--leg").count(), 0, "second tap deselects");
  },
};
