// Port of edfringe/favorites.py — parse a favourites export into a de-duplicated
// list of show slugs. Pure, no I/O: the caller reads the file text and passes it
// in (browser FileReader or Node fs), this module never touches the filesystem.

// Matches https://www.edfringe.com/tickets/whats-on/<slug> (with or without
// "www.", case-insensitive scheme/host), capturing the slug.
const URL_RE = /https?:\/\/(?:www\.)?edfringe\.com\/tickets\/whats-on\/([a-z0-9-]+)/i;
const SLUG_RE = /^[a-z0-9-]+$/i;

/**
 * Extract the show slug from a full edfringe show URL, or fall back to the
 * last non-empty path segment if the URL doesn't match the expected host/path.
 * @param {string} url
 * @returns {string}
 */
export function slugFromUrl(url) {
  const m = URL_RE.exec(url);
  if (m) return m[1];
  return url.replace(/\/+$/, "").split("/").pop();
}

/**
 * Build the canonical edfringe show URL from a slug.
 * @param {string} slug
 * @returns {string}
 */
export function urlFromSlug(slug) {
  return `https://www.edfringe.com/tickets/whats-on/${slug}`;
}

// --- CSV parsing (RFC 4180-ish: quoted fields, "" escaped quote, CRLF/LF) ---

/**
 * Parse CSV text into rows of cells. Handles quoted fields (with embedded
 * commas/newlines/escaped "" quotes) and both CRLF and LF line endings.
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      endCell();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Treat \r\n and lone \r as a single row terminator.
      if (text[i + 1] === "\n") i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      endRow();
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Flush trailing cell/row (file may or may not end with a newline).
  if (cell !== "" || row.length > 0) {
    endRow();
  }
  return rows;
}

/** Strip a leading UTF-8 BOM (U+FEFF) if present. */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Scan every cell of CSV text for edfringe show URLs, collecting de-duplicated
 * slugs in first-seen order. Mirrors favorites.py's `_from_csv`.
 * @param {string} text
 * @returns {string[]}
 */
function slugsFromCsvText(text) {
  const slugs = [];
  const seen = new Set();
  const rows = parseCsv(stripBom(text));
  for (const row of rows) {
    for (const cell of row) {
      const m = URL_RE.exec(cell || "");
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        slugs.push(m[1]);
      }
    }
  }
  return slugs;
}

/**
 * Fallback parser for a plain newline-delimited list of slugs/URLs (one per
 * line, "#" comments and blank lines ignored). Mirrors favorites.py's `_from_txt`.
 * @param {string} text
 * @returns {string[]}
 */
function slugsFromTxtText(text) {
  const slugs = [];
  const seen = new Set();
  for (let line of stripBom(text).split(/\r\n|\r|\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const m = URL_RE.exec(line);
    const slug = m ? m[1] : (SLUG_RE.test(line) ? line : null);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }
  return slugs;
}

/**
 * Parse a favourites export (CSV text, or a plain newline list of URLs/slugs
 * as a fallback) into a de-duplicated list of show slugs, first-seen order.
 *
 * Detection: if any edfringe show URL is found via the CSV scan, use that
 * result. Otherwise fall back to line-based parsing (handles a plain .txt
 * paste, or a CSV with no URL-bearing cells but slug-like lines).
 * @param {string} text raw file contents (CSV or newline list)
 * @returns {string[]} de-duplicated slugs, in first-seen order
 */
export function parseFavourites(text) {
  if (text == null) return [];
  const csvSlugs = slugsFromCsvText(text);
  if (csvSlugs.length > 0) return csvSlugs;
  return slugsFromTxtText(text);
}
