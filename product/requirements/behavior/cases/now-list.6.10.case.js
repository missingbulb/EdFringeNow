"use strict";
const { nowStorage, nowSettings, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "Show more appends the next page of twelve",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    const before = await page.locator(".show-item").count();
    assert.equal(before, 12, "first page is twelve cards");
    const label = (await page.textContent("#showMore")).trim();
    assert.match(label, /^Show \d+ more · \d+ left$/);
    await page.click("#showMore");
    await page.waitForTimeout(300);
    const after = await page.locator(".show-item").count();
    assert.ok(after > before, `more cards after the click (${before} → ${after})`);
  },
};
