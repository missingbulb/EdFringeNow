"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the footer © line carries tooltip 'EdFringeNow v<version>' from package.json",
  localStorage: nowStorage(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    assert.equal(
      await page.getAttribute("#footerVersion", "title"),
      "EdFringeNow v0.0.0-spec" // the fixture-served package.json version
    );
  },
};
