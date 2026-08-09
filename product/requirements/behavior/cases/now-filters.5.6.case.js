"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "everything! ticks every genre; once all are ticked it reads nothing! and clears",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    await page.click('[data-panel="genrePanel"]');
    await page.click("#filterReset"); // "everything!" → all ticked
    await page.waitForTimeout(200);
    assert.equal(await page.locator("#genreOptions input:checked").count(), 10);
    assert.equal((await page.textContent("#filterReset")).trim(), "nothing!");
    await page.click("#filterReset"); // "nothing!" → all cleared
    await page.waitForTimeout(200);
    assert.equal(await page.locator("#genreOptions input:checked").count(), 0);
    assert.equal((await page.textContent("#filterReset")).trim(), "everything!");
  },
};
