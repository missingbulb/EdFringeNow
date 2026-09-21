"use strict";
const path = require("node:path");
const { jerusalemReady } = require("../../shared/case-helpers");

const REPO = path.join(__dirname, "..", "..", "..", "..");

module.exports = {
  description: "choosing a language in the picker navigates to that language's own URL",
  page: "/planJerusalem/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const { STRINGS } = await import(path.join(REPO, "site/planJerusalem/i18n/translations.js"));

    await page.goto(`${origin}/planJerusalem/`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Out to a language, and the reader is on an address they can share.
    await Promise.all([
      page.waitForURL(`${origin}/planJerusalem/he/`),
      page.selectOption("#langSelect", "he"),
    ]);
    await jerusalemReady(page);
    assert.equal(await page.getAttribute("html", "lang"), "he");
    assert.equal((await page.textContent("#pageTitle")).trim(), STRINGS["festival.title"].he);

    // And between two non-default languages, without passing through the root.
    await Promise.all([
      page.waitForURL(`${origin}/planJerusalem/ja/`),
      page.selectOption("#langSelect", "ja"),
    ]);
    await jerusalemReady(page);
    assert.equal(await page.getAttribute("html", "lang"), "ja");

    // Back to the default language is the planner's own URL, not a segment
    // under it — the address every alternate points at as `x-default`.
    await Promise.all([
      page.waitForURL(`${origin}/planJerusalem/`),
      page.selectOption("#langSelect", "en"),
    ]);
    await jerusalemReady(page);
    assert.equal(await page.getAttribute("html", "lang"), "en");
    assert.equal((await page.textContent("#pageTitle")).trim(), STRINGS["festival.title"].en);
  },
};
