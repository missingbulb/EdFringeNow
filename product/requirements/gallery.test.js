// The gallery gate: product/requirements.md's machine-managed lines must be
// byte-equal to the generator's output, and every leaf — and only a leaf —
// must carry exactly one req-gallery marker. Locally the doc is refreshed in
// place first (so `npm test` heals a stale gallery into the working tree for
// review); in CI the committed file is the read-only truth.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { buildGallery, markerLines, DOC_PATH } = require("./shared/gallery");
const { leafRequirementIds } = require("./shared/requirements-doc");

const isCI = Boolean(process.env.CI);

test("gallery is refreshed into the working tree (skipped in CI)", (t) => {
  if (isCI) {
    t.skip("CI: read-only gate — the committed doc is the reviewed truth");
    return;
  }
  fs.writeFileSync(DOC_PATH, buildGallery());
});

test("product/requirements.md gallery matches the generator", () => {
  const committed = fs.readFileSync(DOC_PATH, "utf8");
  assert.equal(
    committed,
    buildGallery(),
    "the managed req-gallery lines are stale — run `node product/requirements/shared/gallery.js` and commit"
  );
});

test("every leaf — and only a leaf — has exactly one gallery marker", () => {
  const leaves = leafRequirementIds();
  const leafSet = new Set(leaves);
  const marks = markerLines(fs.readFileSync(DOC_PATH, "utf8").split("\n"));
  const counts = marks.reduce((acc, { id }) => ((acc[id] = (acc[id] || 0) + 1), acc), {});
  assert.deepEqual(leaves.filter((id) => !counts[id]), [], "leaves with no req-gallery line:");
  assert.deepEqual(Object.keys(counts).filter((id) => counts[id] > 1), [], "leaves with more than one:");
  assert.deepEqual(Object.keys(counts).filter((id) => !leafSet.has(id)), [], "markers on non-leaf ids:");
});
