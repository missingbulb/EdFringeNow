// Maintains the machine-managed gallery lines in product/requirements.md.
// Every leaf's <details> block carries exactly one line tagged
// `<!-- req-gallery:<id> -->`; this generator rewrites ONLY those lines — a
// screen leaf gets its golden embedded, a behavior/logic leaf gets its runner
// note — and never touches the hand-authored prose around them. The gate
// (gallery.test.js) holds the committed doc byte-equal to this output.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DOC_PATH } = require("./requirements-doc");
const { loadCases, leafIdOf } = require("./cases");

const MARKER_RE = /<!--\s*req-gallery:(\d+(?:\.\d+)+)\s*-->/;

const NOTES = {
  behavior: "\u{1F6A9} _Behavior leaf._",
  logic: "\u{1F527} _Logic leaf._",
};

// A rule about how values are written has no picture, but it does have a
// exhaustive answer: the values themselves. A case may declare a `table`, and
// its rows are the ones its verify() proves against the shipped code — so the
// table in the doc is generated evidence, not hand-typed prose. Emitted as
// inline HTML on one line, because the managed unit here is a single line.
function managedTable(table) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const head = table.columns.map((c) => `<th align="left">${esc(c)}</th>`).join("");
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function managedLine(id, testCase) {
  const marker = `<!-- req-gallery:${id} -->`;
  if (!testCase) return `❓ _No case claims this leaf yet — the coverage gate is red._ ${marker}`;
  if (testCase.image) {
    return `![${testCase.name}](requirements/${testCase.kind}/cases/${testCase.name}.png) ${marker}`;
  }
  if (testCase.table) return `${managedTable(testCase.table)} ${marker}`;
  return `${NOTES[testCase.kind] || `_${testCase.kind} leaf._`} ${marker}`;
}

function markerLines(lines) {
  const out = [];
  lines.forEach((line, i) => {
    const m = MARKER_RE.exec(line);
    if (m) out.push({ id: m[1], i });
  });
  return out;
}

function buildGallery(docPath = DOC_PATH) {
  const caseById = new Map(loadCases().map((c) => [leafIdOf(c.name), c]));
  return fs
    .readFileSync(docPath, "utf8")
    .split("\n")
    .map((line) => {
      const m = MARKER_RE.exec(line);
      if (!m) return line;
      const lead = line.match(/^\s*/)[0];
      return `${lead}${managedLine(m[1], caseById.get(m[1]))}`;
    })
    .join("\n");
}

module.exports = { buildGallery, markerLines, MARKER_RE, DOC_PATH };

if (require.main === module) {
  fs.writeFileSync(DOC_PATH, buildGallery());
  console.log(`Refreshed the gallery lines in ${path.relative(process.cwd(), DOC_PATH)}`);
}
