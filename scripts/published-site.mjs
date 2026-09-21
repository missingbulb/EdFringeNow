// What the published site is, for the generators that have to describe it.
//
// The wrangler config names the directory Cloudflare uploads and the
// hostnames it answers on; this reads the first and states the second, so a
// canonical, an hreflang and a sitemap entry all come from one answer rather
// than three copies of it.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SITE_DIR = join(REPO, "site");

// The one hostname a URL the site publishes may name. The wrangler config
// routes the apex here too, which is what a canonical exists to consolidate.
export const ORIGIN = "https://www.edfringenow.com";

/**
 * The `.assetsignore` patterns, as the subset of gitignore syntax that file
 * documents itself as using: a pattern with no slash matches at any depth, one
 * containing a slash is anchored to the site directory.
 */
function ignorePatterns() {
  return readFileSync(join(SITE_DIR, ".assetsignore"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => ({ body: line.replace(/\/$/, ""), anchored: line.replace(/\/$/, "").includes("/") }));
}

function isIgnored(relPath, patterns) {
  const segments = relPath.split(sep);
  return patterns.some(({ body, anchored }) =>
    anchored ? relPath === body || relPath.startsWith(`${body}/`) : segments.includes(body)
  );
}

/**
 * Every HTML page Cloudflare uploads, as a path relative to the site
 * directory. The published set is what wrangler would send, so a page held
 * back by `.assetsignore` is absent here for the same reason it is absent
 * from the live site.
 */
export function publishedPages() {
  const patterns = ignorePatterns();
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(SITE_DIR, full);
      if (isIgnored(rel, patterns)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) found.push(rel);
    }
  };
  walk(SITE_DIR);
  return found.sort();
}

/**
 * The URL a published page is served at, under the site's `auto-trailing-slash`
 * handling: an index is its directory, and every other page keeps its name.
 */
export function urlOf(relPath) {
  const web = relPath.split(sep).join("/");
  return web.endsWith("index.html") ? `/${web.slice(0, -"index.html".length)}` : `/${web}`;
}

/** Whether a page asks search engines to leave it out of their results. */
export function isNoIndex(html) {
  return /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b[^"]*"/.test(html);
}
