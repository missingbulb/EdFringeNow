"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "..", "..", "..", "site");

/** The `<loc>` and its alternates, per `<url>` entry of a sitemap. */
function entriesOf(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: /<loc>([^<]+)<\/loc>/.exec(body)[1],
    alternates: Object.fromEntries(
      [...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map(
        ([, hreflang, href]) => [hreflang, href]
      )
    ),
  }));
}

module.exports = {
  description:
    "each language of the festival planner is listed in the sitemap with the same alternates its own page declares",
  async verify(assert) {
    const { ORIGIN } = await import("../../../../scripts/published-site.mjs");
    const { PAGES } = await import("../../../../scripts/localize-pages.mjs");

    const entries = entriesOf(fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8"));
    const byLoc = new Map(entries.map((e) => [e.loc, e]));

    for (const { code, url, file } of PAGES) {
      const entry = byLoc.get(`${ORIGIN}${url}`);
      assert.ok(entry, `${url}: the sitemap does not list it`);

      // Read from the page's own markup rather than from the registry both
      // were built from: what this proves is that the two annotations agree,
      // which comparing each to a third copy would not.
      const onPage = Object.fromEntries(
        [
          ...fs
            .readFileSync(file, "utf8")
            .matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g),
        ].map(([, hreflang, href]) => [hreflang, href])
      );
      assert.deepEqual(
        entry.alternates,
        onPage,
        `${url}: the sitemap's alternates and the page's own disagree`
      );
      assert.ok(entry.alternates[code], `${url}: its own language is missing from the set`);
      assert.ok(entry.alternates["x-default"], `${url}: no x-default`);
    }

    // And nothing else claims alternates — a page with one language has no
    // business naming any.
    const localized = new Set(PAGES.map((p) => `${ORIGIN}${p.url}`));
    for (const entry of entries) {
      if (localized.has(entry.loc)) continue;
      assert.deepEqual(entry.alternates, {}, `${entry.loc}: claims language alternates it does not have`);
    }
  },
};
