"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "chip labels: '2 genres', red $ with 'Up to £15', 'Bike ≤ 25 min'",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);

    // Genres: tick a second one → "2 genres".
    await page.click('[data-panel="genrePanel"]');
    await page.click('#genreOptions label:has-text("Theatre")');
    await page.waitForTimeout(200);
    assert.equal(await page.textContent('[data-value="genre"]'), "2 genres");

    // Price: pick £15 → the chip shows the label and turns set.
    await page.click('[data-panel="pricePanel"]');
    await page.click('#priceOptions .seg-btn:has-text("£15")');
    await page.waitForTimeout(200);
    assert.equal(await page.textContent('[data-value="price"]'), "Up to £15");
    assert.ok(await page.locator(".card--price.is-set").count() > 0);

    // Travel: Bicycle at 25 → "Bike ≤ 25 min".
    await page.click('[data-panel="travelPanel"]');
    await page.click('#travelOptions label:has-text("Bicycle")');
    await page.locator("#travelRange").fill("25");
    await page.waitForTimeout(200);
    assert.equal(await page.textContent('[data-value="travel"]'), "Bike ≤ 25 min");
  },
};
