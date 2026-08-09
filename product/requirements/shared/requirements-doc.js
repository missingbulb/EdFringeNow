// Parses product/requirements.md into its numbered requirement IDs — the
// single source of truth for the requirement list, shared by the coverage gate
// and the gallery generator so neither hard-codes it.
//
// A requirement is a line whose first token (after an optional list dash) is a
// backtick-wrapped dotted number, e.g. "- `4.2` The map pin …". Section
// headings and in-prose cross-references aren't at a line's start, so they're
// ignored. A "leaf" is a requirement with no finer-grained child (4.2 is not a
// leaf when 4.2.1 exists); every leaf must have exactly one case.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DOC_PATH = path.join(__dirname, "..", "..", "requirements.md");

// The framework-standard requirement-line regex (executable-requirements pack).
const REQ_LINE = /^\s*(?:-\s+)?`(\d+(?:\.\d+)+)`/;

function allRequirementIds(docPath = DOC_PATH) {
  const text = fs.readFileSync(docPath, "utf8");
  const ids = [];
  const seen = new Set();
  for (const line of text.split("\n")) {
    const m = REQ_LINE.exec(line);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  return ids;
}

function leafRequirementIds(docPath = DOC_PATH) {
  const ids = allRequirementIds(docPath);
  return ids.filter((id) => !ids.some((other) => other !== id && other.startsWith(`${id}.`)));
}

module.exports = { allRequirementIds, leafRequirementIds, DOC_PATH, REQ_LINE };
