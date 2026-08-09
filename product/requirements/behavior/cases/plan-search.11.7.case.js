"use strict";
const { planReady } = require("../../shared/case-helpers");

module.exports = {
  description: "clicking away clears the typed query and closes the popup — facet filters stay",
  page: "/plan/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    // Without facets: click-away clears the text and closes the popup.
    await page.fill("#ssInput", "improv");
    await page.waitForSelector("#ssPop:not([hidden])");
    await page.click(".page-title");
    await page.waitForTimeout(300);
    assert.equal(await page.inputValue("#ssInput"), "", "query text cleared");
    assert.ok(await page.locator("#ssPop").isHidden(), "popup closed");

    // With a facet active: the text still clears and the facet stays — the
    // popup remains as the filtered browse list (empty query + filters).
    await page.click("#ssToolsBtn");
    await page.click('[data-panel="ssfGenrePanel"]');
    await page.click('#ssfGenreOptions label:has-text("Comedy")');
    await page.keyboard.press("Escape");
    await page.fill("#ssInput", "improv");
    await page.waitForSelector("#ssPop:not([hidden])");
    await page.click(".page-title");
    await page.waitForTimeout(300);
    assert.equal(await page.inputValue("#ssInput"), "", "query text cleared (facet active)");
    assert.equal((await page.textContent("#ssfGenreValue")).trim(), "Comedy", "facet kept");
    assert.equal((await page.textContent("#ssBadge")).trim(), "1", "badge still counts the facet");
  },
};
