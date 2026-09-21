"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the theme a reader picks survives a reload, in the festival's own storage",
  page: "/planJerusalem/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planJerusalem/`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Nothing stored and a light device: no theme pinned either way.
    assert.equal(await page.getAttribute("html", "data-theme"), null);

    await page.click("#themeToggle");
    assert.equal(await page.getAttribute("html", "data-theme"), "dark");

    // Shared code, never shared state: the choice is under this festival's own
    // prefix, and the Edinburgh planner's keys are untouched. The theme is the
    // only thing here storage carries — the language is the URL's (19.7).
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    assert.deepEqual(keys, ["jerusalemPlan.theme"]);

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(
      await page.getAttribute("html", "data-theme"),
      "dark",
      "and the page came back dark rather than just remembering that it should be"
    );
  },
};
