"use strict";
const path = require("node:path");
const { jerusalemReady } = require("../../shared/case-helpers");

const REPO = path.join(__dirname, "..", "..", "..", "..");

module.exports = {
  description: "the page speaks the language its URL names, whatever the device asks for and whatever was visited before",
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const { LOCALES, DEFAULT_LOCALE, STRINGS } = await import(
      path.join(REPO, "site/planNG/i18n/translations.js")
    );

    // A device that asks for Hebrew, for the whole case: the page must not
    // answer it. A page that redirected on this would be a page whose other
    // languages no reader and no crawler could reach.
    await page.addInitScript(`
      Object.defineProperty(navigator, "language", { get: () => "he-IL" });
      Object.defineProperty(navigator, "languages", { get: () => ["he-IL", "he", "en"] });
    `);

    for (const { code, dir } of LOCALES) {
      const url = code === DEFAULT_LOCALE ? "/planNG/" : `/planNG/${code}/`;
      await page.goto(`${origin}${url}`, { waitUntil: "load" });
      await jerusalemReady(page);

      assert.equal(await page.getAttribute("html", "lang"), code, `${url}: the document's language`);
      assert.equal(await page.getAttribute("html", "dir"), dir, `${url}: the document's direction`);
      assert.equal(await page.inputValue("#langSelect"), code, `${url}: the picker agrees with the URL`);
      assert.equal(
        (await page.textContent("#pageTitle")).trim(),
        STRINGS["festival.title"][code].replace("{festival}", STRINGS["fest.jerusalem-comedy.name"][code]),
        `${url}: the page reads in that language rather than just declaring it`
      );

      // Nothing about the language is stored, so the previous URL's language
      // cannot follow the reader to the next one — which is what makes a
      // shared link mean the same thing to everyone who opens it.
      const stored = await page.evaluate(() => Object.keys(localStorage).sort());
      assert.deepEqual(
        stored.filter((k) => k.includes("lang")),
        [],
        `${url}: nothing stored carries the language`
      );
    }

    // And back to the bare URL last, with Hebrew both on the device and in the
    // page just visited: still English.
    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.equal(await page.getAttribute("html", "lang"), DEFAULT_LOCALE);
    assert.equal(
      (await page.textContent("#pageTitle")).trim(),
      STRINGS["festival.title"][DEFAULT_LOCALE].replace("{festival}", STRINGS["fest.jerusalem-comedy.name"][DEFAULT_LOCALE])
    );
  },
};
