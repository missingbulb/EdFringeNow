"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the footer © line shows a help cursor and the 'EdFringeNow v<version>' tooltip",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    assert.equal(
      await page.getAttribute("#footerVersion", "title"),
      "EdFringeNow v0.0.0-spec" // the fixture-served package.json version
    );
    // The cursor is what advertises the tooltip — neither is capturable in a
    // screenshot (both are painted by the OS, not the page), so both are
    // asserted here.
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById("footerVersion")).cursor),
      "help"
    );
  },
};
