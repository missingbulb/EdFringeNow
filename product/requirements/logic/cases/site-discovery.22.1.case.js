"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "..", "..", "..", "site");

// The rows are the requirement: every page this site publishes for a reader,
// and the file that answers it. verify() reads them off the published tree —
// nothing here is a list kept by hand.
const TABLE = {
  columns: ["URL", "Served from"],
  rows: [
    ["/", "index.html"],
    ["/accessibility.html", "accessibility.html"],
    ["/plan/", "plan/index.html"],
    ["/planJerusalem/", "planJerusalem/index.html"],
    ["/planJerusalem/he/", "planJerusalem/he/index.html"],
    ["/planJerusalem/ja/", "planJerusalem/ja/index.html"],
    ["/planJerusalem/ru/", "planJerusalem/ru/index.html"],
    ["/privacy.html", "privacy.html"],
    ["/terms.html", "terms.html"],
  ],
};

module.exports = {
  description: "the sitemap names every page the site publishes for a reader, at the URL it is served at",
  table: TABLE,
  async verify(assert) {
    const { ORIGIN, urlOf } = await import("../../../../scripts/published-site.mjs");
    const { buildSitemap, listedPages } = await import("../../../../scripts/build-sitemap.mjs");

    // 1. the table is the published tree, not a copy of it
    assert.deepEqual(
      TABLE.rows,
      listedPages()
        .map((page) => [urlOf(page), page.split(path.sep).join("/")])
        .sort((a, b) => a[0].localeCompare(b[0])),
      "the table names the pages the site publishes"
    );
    for (const [url, file] of TABLE.rows) {
      assert.ok(fs.existsSync(path.join(SITE, file)), `${url}: ${file} is not committed`);
    }

    // 2. and the committed sitemap names exactly those, at those URLs
    const sitemap = fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8");
    assert.deepEqual(
      [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
      TABLE.rows.map(([url]) => `${ORIGIN}${url}`),
      "every page is listed once, in site order"
    );

    // 3. and it is the generator's output, so a page added to the site without
    //    a re-run fails here rather than going quietly unlisted.
    assert.equal(
      sitemap,
      buildSitemap(),
      "site/sitemap.xml is not what scripts/build-sitemap.mjs writes — run it and commit the result"
    );
  },
};
