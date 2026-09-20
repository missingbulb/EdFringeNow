#!/usr/bin/env node
//
// Writes the two files a search engine reads before it reads the site:
// `sitemap.xml`, naming every page published for a reader, and `robots.txt`,
// whose only job here is to name the sitemap.
//
//   node scripts/build-sitemap.mjs            write them
//   node scripts/build-sitemap.mjs --check    re-derive and compare, exit 1 on drift
//
// Both are derived from the published tree rather than kept by hand, so a page
// added to the site is described without anyone remembering to come here. What
// stays out says so on its own page — a `noindex` meta — rather than in a
// second list beside this one.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ORIGIN, SITE_DIR, isNoIndex, publishedPages, urlOf } from "./published-site.mjs";
import { DEFAULT_PAGE, PAGES as LOCALIZED_PAGES } from "./localize-pages.mjs";

const SITEMAP = join(SITE_DIR, "sitemap.xml");
const ROBOTS = join(SITE_DIR, "robots.txt");
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;

/** The pages the sitemap names: everything published that asks to be found. */
export function listedPages() {
  return publishedPages().filter((page) => !isNoIndex(readFileSync(join(SITE_DIR, page), "utf8")));
}

/**
 * The languages a URL is also served in, as the sitemap's own alternate form.
 *
 * Read from the festival planner's own registry rather than restated, so the
 * sitemap cannot claim a set of languages the pages themselves don't carry.
 */
function alternatesFor(url) {
  if (!LOCALIZED_PAGES.some((p) => p.url === url)) return [];
  return [
    ...LOCALIZED_PAGES.map((p) => ({ hreflang: p.code, href: `${ORIGIN}${p.url}` })),
    { hreflang: "x-default", href: `${ORIGIN}${DEFAULT_PAGE.url}` },
  ];
}

export function buildSitemap() {
  const entries = listedPages()
    .map(urlOf)
    // By URL rather than by file path, so the file reads down the site the way
    // a visitor would walk it — the root first, each planner beside its own
    // languages.
    .sort()
    .map((url) => {
      const alternates = alternatesFor(url)
        .map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
        .join("");
      return `  <url>\n    <loc>${ORIGIN}${url}</loc>${alternates}\n  </url>`;
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

export function buildRobots() {
  return [
    "# Everything here is public. What must not be listed says so on its own",
    "# page, with a noindex meta, which keeps it out of results rather than",
    "# merely out of a crawl — so nothing is disallowed below.",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${SITEMAP_URL}`,
    "",
  ].join("\n");
}

/** Both files, keyed by the path each is written to. */
export function buildAll() {
  return { [SITEMAP]: buildSitemap(), [ROBOTS]: buildRobots() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = buildAll();
  if (process.argv.includes("--check")) {
    const drifted = Object.keys(files).filter((path) => {
      try {
        return readFileSync(path, "utf8") !== files[path];
      } catch {
        return true;
      }
    });
    if (drifted.length) {
      console.error("These files are not what scripts/build-sitemap.mjs would write:");
      for (const path of drifted) console.error(`  site/${path.slice(SITE_DIR.length + 1)}`);
      console.error("Run `node scripts/build-sitemap.mjs` and commit the result.");
      process.exit(1);
    }
    console.log(`sitemap.xml and robots.txt match the generator (${listedPages().length} pages listed)`);
  } else {
    for (const [path, body] of Object.entries(files)) writeFileSync(path, body);
    console.log(`Wrote sitemap.xml (${listedPages().length} pages) and robots.txt`);
  }
}

export { SITEMAP, ROBOTS, SITEMAP_URL };
