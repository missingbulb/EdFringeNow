"use strict";
const path = require("node:path");
const { jerusalemReady } = require("../../shared/case-helpers");

const REPO = path.join(__dirname, "..", "..", "..", "..");

module.exports = {
  description: "the language and theme a reader picks survive a reload, in the festival's own storage",
  page: "/planJerusalem/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const { STRINGS } = await import(path.join(REPO, "site/planJerusalem/i18n/translations.js"));
    await page.goto(`${origin}/planJerusalem/`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Nothing stored and a light device: English, left to right, no theme pinned.
    assert.equal(await page.getAttribute("html", "lang"), "en");
    assert.equal(await page.getAttribute("html", "dir"), "ltr");
    assert.equal(await page.getAttribute("html", "data-theme"), null);

    await page.selectOption("#langSelect", "he");
    await page.click("#themeToggle");
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    assert.equal(await page.getAttribute("html", "data-theme"), "dark");

    // Shared code, never shared state: both choices are under this festival's
    // own prefix, and the Edinburgh planner's keys are untouched.
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    assert.deepEqual(keys, ["jerusalemPlan.lang", "jerusalemPlan.theme"]);

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(await page.getAttribute("html", "lang"), "he");
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    assert.equal(await page.getAttribute("html", "data-theme"), "dark");
    assert.equal(await page.inputValue("#langSelect"), "he");
    assert.equal(
      (await page.textContent("#pageTitle")).trim(),
      STRINGS["festival.title"].he,
      "and the page came back in Hebrew rather than just pointing at it"
    );
  },
};
