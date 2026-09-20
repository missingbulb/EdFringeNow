"use strict";

const fs = require("node:fs");

// The rows are the requirement: where each language is served, and what the
// document it serves says it is. verify() reads them off the committed bytes —
// nothing here is a list this repo keeps by hand.
const TABLE = {
  columns: ["URL", "Language", "html lang", "Direction"],
  rows: [
    ["/planJerusalem/", "English", "en", "ltr"],
    ["/planJerusalem/he/", "עברית", "he", "rtl"],
    ["/planJerusalem/ru/", "Русский", "ru", "ltr"],
    ["/planJerusalem/ja/", "日本語", "ja", "ltr"],
  ],
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = {
  description:
    "each language is served as its own document, already in that language before a line of script has run",
  table: TABLE,
  async verify(assert) {
    const { STRINGS } = await import("../../../../site/planJerusalem/i18n/translations.js");
    const { PAGES, buildPages } = await import("../../../../scripts/localize-pages.mjs");

    assert.deepEqual(
      TABLE.rows.map((r) => [r[0], r[1], r[2], r[3]]),
      PAGES.map((p) => [p.url, p.endonym, p.code, p.dir]),
      "the table names the languages and the URLs the generator serves them at"
    );

    for (const { code, dir, url, file } of PAGES) {
      assert.ok(fs.existsSync(file), `${url}: no page is committed for it`);
      const html = fs.readFileSync(file, "utf8");

      // 1. the document says what it is, in the bytes a browser first receives
      //    — which is what it decides a translation offer from.
      assert.match(html, new RegExp(`<html lang="${code}" dir="${dir}">`), `${url}: the html element`);
      assert.match(
        html,
        new RegExp(`<title>${escapeHtml(STRINGS["doc.title"][code]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</title>`),
        `${url}: the document title is in ${code}`
      );
      const description = /<meta name="description" content="([^"]*)"/.exec(html);
      assert.ok(description, `${url}: no description`);
      assert.equal(description[1], escapeHtml(STRINGS["doc.description"][code]), `${url}: the description is in ${code}`);

      // 2. and so is every string the markup binds — none of it waiting on the
      //    page's own applyTranslations() to arrive.
      const bound = [...html.matchAll(/\sdata-i18n="([a-zA-Z][\w.]*)"/g)];
      assert.ok(bound.length > 20, `${url}: only ${bound.length} bound strings — the markup cannot have been read`);
      for (const [, key] of bound) {
        assert.ok(
          html.includes(`>${escapeHtml(STRINGS[key][code])}<`),
          `${url}: ${key} is not rendered in ${code}`
        );
      }
      for (const [, attr, key] of html.matchAll(/\sdata-i18n-([a-z-]+)="([a-zA-Z][\w.]*)"/g)) {
        if (attr === "slot") continue;
        assert.ok(
          html.includes(`${attr}="${escapeHtml(STRINGS[key][code])}"`),
          `${url}: ${key} is not written out as ${attr} in ${code}`
        );
      }
    }

    // 3. and the committed pages are the generator's output, so a hand-edit or
    //    a source that moved without a re-run fails here rather than shipping.
    const built = buildPages();
    for (const { url, file } of PAGES) {
      assert.equal(
        fs.readFileSync(file, "utf8"),
        built[file],
        `${url}: not what scripts/localize-pages.mjs writes — run it and commit the result`
      );
    }
  },
};
