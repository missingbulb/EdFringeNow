"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PAGE_DIR = path.join(__dirname, "..", "..", "..", "..", "planJerusalem");

// The rows are the requirement: every language the page offers, what it is
// called, which way it runs, and the plural forms its translations must supply.
// verify() proves each one against the shipped catalogue and against
// Intl.PluralRules — nothing here is a list this repo keeps by hand.
const TABLE = {
  columns: ["Language", "Code", "Direction", "Plural categories"],
  rows: [
    ["English", "en", "ltr", "one, other"],
    ["עברית", "he", "rtl", "one, two, other"],
    ["Русский", "ru", "ltr", "few, many, one, other"],
    ["日本語", "ja", "ltr", "other"],
  ],
};

/** Every source file that can name a key, so a dead key is a failing key. */
function pageSources() {
  const files = [
    "index.html",
    "planJerusalem.js",
    "festival.js",
    "catalogue.js",
    // the runtime names the handful of keys no markup binds: the document's own
    // title and description, and the theme toggle's two labels
    path.join("i18n", "i18n.js"),
  ].map((f) => path.join(PAGE_DIR, f));
  return files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
}

module.exports = {
  description:
    "every UI string is translated into every supported language, with the arguments and plural forms each language needs",
  table: TABLE,
  async verify(assert) {
    const { LOCALES, DEFAULT_LOCALE, STRINGS } = await import("../../../../planJerusalem/i18n/translations.js");
    const { argumentsOf, pluralCategoriesOf, format } = await import("../../../../planJerusalem/i18n/format.js");

    const codes = LOCALES.map((l) => l.code);
    assert.deepEqual(
      TABLE.rows.map((r) => [r[0], r[1], r[2]]),
      LOCALES.map((l) => [l.endonym, l.code, l.dir]),
      "the table names the languages the catalogue ships"
    );
    for (const [, code, , categories] of TABLE.rows) {
      assert.equal(
        new Intl.PluralRules(code).resolvedOptions().pluralCategories.join(", "),
        categories,
        `${code}: the table's plural categories are the language's own`
      );
    }
    assert.ok(codes.includes(DEFAULT_LOCALE), "the default language is one of the supported ones");

    const META = new Set(["maxWidthPx", "unrendered", "probe", "sample"]);
    const source = pageSources();

    for (const [key, entry] of Object.entries(STRINGS)) {
      // 1. every language, and nothing but the languages
      for (const code of codes) {
        assert.equal(typeof entry[code], "string", `${key}: ${code} is missing`);
        assert.ok(entry[code].trim().length > 0, `${key}: ${code} is empty`);
      }
      const strays = Object.keys(entry).filter((f) => !META.has(f) && !codes.includes(f));
      assert.deepEqual(strays, [], `${key}: fields that are neither a language nor a known one`);

      // 2. a width budget, or a stated reason there is nothing to budget
      if (entry.maxWidthPx === null) {
        assert.ok(
          typeof entry.unrendered === "string" && entry.unrendered.trim().length > 0,
          `${key}: a null budget has to say why the string has no box`
        );
      } else {
        assert.ok(
          Number.isFinite(entry.maxWidthPx) && entry.maxWidthPx > 0,
          `${key}: maxWidthPx must be a positive number of CSS pixels, or null with a reason`
        );
        assert.equal(entry.unrendered, undefined, `${key}: a budgeted string is rendered`);
      }

      // 3. the same arguments in every language, and every plural form the
      //    language has — the translation, not the page, decides the wording,
      //    but it cannot drop a value or a form the language needs.
      const expected = [...argumentsOf(entry[DEFAULT_LOCALE])].sort();
      for (const code of codes) {
        assert.deepEqual([...argumentsOf(entry[code])].sort(), expected, `${key}: ${code}'s arguments`);
        for (const [arg, offered] of pluralCategoriesOf(entry[code])) {
          for (const category of new Intl.PluralRules(code).resolvedOptions().pluralCategories) {
            assert.ok(
              offered.has(category),
              `${key}: ${code}'s {${arg}} has no "${category}" form, which ${code} needs`
            );
          }
        }
        // 4. and it formats — a malformed pattern throws here rather than on the page
        const sample = entry.sample || {};
        const params = Object.fromEntries(expected.map((a) => [a, sample[a] ?? 2]));
        assert.doesNotThrow(() => format(entry[code], params, code), `${key}: ${code} formats`);
      }

      // 5. a key nothing names is a key nobody translates for a reason
      assert.ok(source.includes(key), `${key}: no page source names this key`);
    }

    // 6. and every key the markup binds is a key the catalogue has
    const markup = fs.readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
    for (const bound of markup.matchAll(/data-i18n(?:-[a-z-]+)?="([a-z][a-zA-Z0-9.]*)"/g)) {
      assert.ok(STRINGS[bound[1]], `the markup binds ${bound[1]}, which the catalogue has no entry for`);
    }
  },
};
