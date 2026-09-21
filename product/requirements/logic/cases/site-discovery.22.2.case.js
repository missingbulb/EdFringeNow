"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "..", "..", "..", "site");

module.exports = {
  description: "a page carrying a noindex meta is published but kept out of the sitemap",
  async verify(assert) {
    const { ORIGIN, isNoIndex, publishedPages, urlOf } = await import(
      "../../../../scripts/published-site.mjs"
    );
    const { listedPages } = await import("../../../../scripts/build-sitemap.mjs");

    const published = publishedPages();
    const listed = new Set(listedPages());

    // The page's own meta decides, in both directions — so there is no second
    // list beside the sitemap that could fall out of step with it.
    for (const page of published) {
      const html = fs.readFileSync(path.join(SITE, page), "utf8");
      assert.equal(
        listed.has(page),
        !isNoIndex(html),
        `${page}: listed in the sitemap iff it does not ask to be left out`
      );
    }

    // The two that ask, today: a prototype running on invented data, and a
    // page that is not a page. Both are still served — this keeps them out of
    // results, not out of reach.
    const excluded = published.filter((page) => !listed.has(page));
    assert.deepEqual(excluded.sort(), ["404.html", path.join("plan2", "index.html")].sort());

    const sitemap = fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8");
    for (const page of excluded) {
      assert.ok(fs.existsSync(path.join(SITE, page)), `${page}: excluded from the sitemap but also unpublished`);
      assert.ok(
        !sitemap.includes(`<loc>${ORIGIN}${urlOf(page)}</loc>`),
        `${page}: named in the sitemap despite asking not to be indexed`
      );
    }
  },
};
