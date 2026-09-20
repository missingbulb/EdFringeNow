"use strict";

const fs = require("node:fs");

/** Every `rel="alternate" hreflang=…` a page declares, as {hreflang: href}. */
function alternatesOf(html) {
  const found = {};
  for (const [, hreflang, href] of html.matchAll(
    /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g
  )) {
    found[hreflang] = href;
  }
  return found;
}

module.exports = {
  description:
    "every language's page names itself canonical and points at all the others, including a default",
  async verify(assert) {
    const { PAGES, ORIGIN } = await import("../../../../scripts/localize-pages.mjs");

    const defaultPage = PAGES.find((p) => p.url.endsWith("/planJerusalem/"));
    assert.ok(defaultPage, "one language is served at the planner's own URL");

    // What every page must say, once built: it is itself, and here is where
    // each language lives. Identical across the four, which is the whole point
    // — an alternate set a search engine can only trust when it is reciprocal.
    const expected = Object.fromEntries([
      ...PAGES.map((p) => [p.code, `${ORIGIN}${p.url}`]),
      // The language to answer a reader whose own is not among them.
      ["x-default", `${ORIGIN}${defaultPage.url}`],
    ]);

    for (const { code, url, file } of PAGES) {
      const html = fs.readFileSync(file, "utf8");

      const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]+)" \/>/g)];
      assert.equal(canonical.length, 1, `${url}: exactly one canonical`);
      assert.equal(
        canonical[0][1],
        `${ORIGIN}${url}`,
        `${url}: names itself canonical — a page that named another language's URL would ask to be dropped from the index`
      );

      assert.deepEqual(alternatesOf(html), expected, `${url}: its alternate set`);
      assert.ok(expected[code], `${url}: a page lists its own language among the alternates`);
    }

    // And every href points at a page that is actually committed, in both
    // directions: no alternate naming a URL nothing serves, and no served
    // language the others fail to mention.
    const served = new Map(PAGES.map((p) => [`${ORIGIN}${p.url}`, p.file]));
    for (const [hreflang, href] of Object.entries(expected)) {
      assert.ok(served.has(href), `${hreflang}: ${href} is not a page this site serves`);
      assert.ok(fs.existsSync(served.get(href)), `${hreflang}: ${href} has no committed file`);
    }
    for (const { code, url } of PAGES) {
      assert.equal(expected[code], `${ORIGIN}${url}`, `${code} is served but the alternates point elsewhere`);
    }
  },
};
