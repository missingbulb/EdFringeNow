#!/usr/bin/env node
//
// Derives one served page per language from the festival planner's own
// index.html, so a language is an address rather than a runtime decision.
//
// What that buys, and why the strings are baked in rather than left to the
// page's own applyTranslations(): a browser decides whether to offer a
// translation from the document it received. A page that arrives in English
// and becomes Hebrew a moment later is offered the wrong translation, and a
// crawler that is served a different language per request has one URL to index
// for four languages. Both are answered by shipping each language as its own
// document, already in that language.
//
//   node scripts/localize-pages.mjs            write the pages
//   node scripts/localize-pages.mjs --check    re-derive and compare, exit 1 on drift
//
// The source page IS the default language's page: this writes each other
// language beside it, and maintains the `localization:` block — canonical and
// hreflang — in all of them, that one block being the only part of the default
// language's own page it owns.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_DIR = join(REPO, "site", "planJerusalem");
const SOURCE = join(PAGE_DIR, "index.html");

const { DEFAULT_LOCALE, LOCALES, STRINGS } = await import(
  join(PAGE_DIR, "i18n", "translations.js")
);
const { localeHref } = await import(join(PAGE_DIR, "i18n", "i18n.js"));
const { FESTIVAL } = await import(join(PAGE_DIR, "festival.js"));

// The one hostname the site answers on, and so the one a canonical and an
// hreflang may name: an alternate that named a host the site does not serve
// would point a crawler at nothing. The wrangler config routes the apex here
// too, which is exactly what a canonical exists to consolidate.
export const ORIGIN = "https://www.edfringenow.com";

/**
 * Every language this page is served in: what it is called, which way it runs,
 * the URL it answers on and the file that answers. One list, so the generator
 * and the requirements that check its output never disagree about where a
 * language lives.
 */
export const PAGES = LOCALES.map((locale) => ({
  ...locale,
  url: localeHref(locale.code, FESTIVAL.pageRoot),
  file:
    locale.code === DEFAULT_LOCALE ? SOURCE : join(PAGE_DIR, locale.code, "index.html"),
}));

/** The page served at the planner's own URL, which `x-default` names. */
export const DEFAULT_PAGE = PAGES.find((p) => p.code === DEFAULT_LOCALE);

const BEGIN = "<!-- localization:begin";
const END = "<!-- localization:end -->";

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** One language's string for a key, in the language it is being written for. */
function t(key, code) {
  const entry = STRINGS[key];
  if (!entry) throw new Error(`no such translation key: ${key}`);
  const value = entry[code];
  if (typeof value !== "string") throw new Error(`${key}: no ${code} translation`);
  return value;
}

/**
 * The canonical and hreflang block every language carries.
 *
 * Each page names itself canonical and lists every language including its own
 * — the reciprocal set a search engine needs to read four URLs as one page in
 * four languages rather than four pages competing. `x-default` is the default
 * language's URL: what to serve a reader whose own language is not among them.
 */
function localizationBlock(code, indent) {
  const lines = [
    `<link rel="canonical" href="${ORIGIN}${localeHref(code, FESTIVAL.pageRoot)}" />`,
    ...LOCALES.map(
      (l) => `<link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${localeHref(l.code, FESTIVAL.pageRoot)}" />`
    ),
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${localeHref(DEFAULT_LOCALE, FESTIVAL.pageRoot)}" />`,
  ];
  return lines.map((l) => indent + l).join("\n");
}

function replaceManagedBlock(html, code) {
  const start = html.indexOf(BEGIN);
  const end = html.indexOf(END);
  if (start < 0 || end < 0) throw new Error(`${SOURCE}: the localization: block is missing`);
  const lineStart = html.lastIndexOf("\n", start) + 1;
  const indent = html.slice(lineStart, start);
  const head = html.slice(0, start + html.slice(start).indexOf("\n") + 1);
  // From the start of the closing marker's own LINE, so it keeps the
  // indentation it is written with rather than losing it to the slice.
  const tail = html.slice(html.lastIndexOf("\n", end) + 1);
  return head + localizationBlock(code, indent) + "\n" + tail;
}

/**
 * Replace the text of every element bound with `data-i18n`.
 *
 * A bound element holds plain text and nothing else — no nested markup — which
 * is what makes this a replacement rather than a parse. That is asserted here
 * rather than assumed, so markup that outgrows the rule fails the build
 * instead of silently shipping a half-translated page.
 */
function applyTextBindings(html, code) {
  const open = /<([a-z][a-z0-9]*)\b[^>]*\sdata-i18n="([a-zA-Z][\w.]*)"[^>]*>/g;
  let out = "";
  let read = 0;
  let match;
  while ((match = open.exec(html))) {
    const [tag, name, key] = match;
    const contentStart = match.index + tag.length;
    const close = `</${name}>`;
    const contentEnd = html.indexOf("<", contentStart);
    if (contentEnd < 0 || !html.startsWith(close, contentEnd)) {
      throw new Error(
        `${key}: the element bound to it holds markup, not plain text — ` +
          "a bound element's content is replaced wholesale, so it cannot contain another element"
      );
    }
    out += html.slice(read, contentStart) + escapeHtml(t(key, code));
    read = contentEnd;
    open.lastIndex = contentEnd;
  }
  return out + html.slice(read);
}

/**
 * Write every `data-i18n-<attr>` binding out as that attribute.
 *
 * The page does the same at runtime off `dataset`; from the markup the
 * attribute is simply the binding's own suffix. `data-i18n-slot` is not a
 * binding — it names the key an element's own code renders — so it is left
 * alone, and the bindings themselves stay in the markup because the page
 * re-applies them when the theme changes.
 *
 * A previous run's attribute is dropped before the fresh one is written, so
 * running this over its own output writes the same bytes rather than a second
 * copy of every label — which it has to, the default language's page being
 * both this generator's source and one of its outputs.
 */
function applyAttributeBindings(html, code) {
  return html
    .replace(/(\sdata-i18n-([a-z-]+)="[^"]*")\s\2="[^"]*"/g, "$1")
    .replace(/\sdata-i18n-([a-z-]+)="([a-zA-Z][\w.]*)"/g, (whole, attr, key) =>
      attr === "slot" ? whole : `${whole} ${attr}="${escapeHtml(t(key, code))}"`
    );
}

/**
 * One language's whole page.
 *
 * The default language's page is the source AND an output: it is derived the
 * same way as the others, so the catalogue is the only home of a string and
 * the markup's own words cannot quietly drift from it.
 */
export function buildPage(source, code) {
  const locale = LOCALES.find((l) => l.code === code);
  if (!locale) throw new Error(`no such language: ${code}`);

  let html = replaceManagedBlock(source, code);
  html = html.replace(
    /<html lang="[^"]*" dir="[^"]*">/,
    `<html lang="${locale.code}" dir="${locale.dir}">`
  );
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(t("doc.title", code))}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    (_, head, tail) => head + escapeHtml(t("doc.description", code)) + tail
  );
  html = applyTextBindings(html, code);
  html = applyAttributeBindings(html, code);
  if (code === DEFAULT_LOCALE) return html;
  return html.replace(
    /^<!DOCTYPE html>\n/,
    "<!DOCTYPE html>\n<!-- Generated by scripts/localize-pages.mjs from ../index.html — run it rather than editing this file. -->\n"
  );
}

/** Every page this writes, keyed by the path it is written to. */
export function buildPages(source = readFileSync(SOURCE, "utf8")) {
  return Object.fromEntries(PAGES.map(({ code, file }) => [file, buildPage(source, code)]));
}

// Run only when run: the requirements harness imports buildPages() to compare
// the committed pages against what this would write, and an import must not
// write anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pages = buildPages();
  if (process.argv.includes("--check")) {
    const drifted = Object.keys(pages).filter((path) => {
      try {
        return readFileSync(path, "utf8") !== pages[path];
      } catch {
        return true;
      }
    });
    if (drifted.length) {
      console.error("These pages are not what scripts/localize-pages.mjs would write:");
      for (const path of drifted) console.error(`  ${path.slice(REPO.length + 1)}`);
      console.error("Run `node scripts/localize-pages.mjs` and commit the result.");
      process.exit(1);
    }
    console.log(`${Object.keys(pages).length} localized page(s) match the generator`);
  } else {
    for (const [path, html] of Object.entries(pages)) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, html);
    }
    console.log(`Wrote ${Object.keys(pages).length} page(s): ${LOCALES.map((l) => l.code).join(", ")}`);
  }
}
