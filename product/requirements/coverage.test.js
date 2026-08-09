// The coverage gate: the strict bijection between product/requirements.md and
// the cases that prove it, plus the structural rules each kind implies. Runs in
// the default `npm test` lane (no browser), so a spec/case mismatch is red
// everywhere. What it must fail on (the executable-requirements standard):
//   - a leaf no case claims (doc-first: a new leaf is red until proven)
//   - a case claiming a non-existent leaf, or a misnamed case file
//   - two cases claiming one leaf
//   - a kind directory with no descriptor (invisible to the registry)
//   - an image golden inside a coded kind's folder (a PNG can't verify a
//     gesture or a pure rule)
//   - a stray golden no case accounts for
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadCases, leafIdOf, goldenPath } = require("./shared/cases");
const { allRequirementIds, leafRequirementIds } = require("./shared/requirements-doc");
const { KINDS, KIND_NAMES } = require("./shared/kinds");

const allIds = new Set(allRequirementIds());
const leaves = leafRequirementIds();
const cases = loadCases();

const PER_LEAF = /^[a-z][a-z0-9-]*\.(\d+(?:\.\d+)+)$/;

test("product/requirements.md yields leaf requirements", () => {
  assert.ok(allIds.size > 0, "no `N.M` requirement IDs parsed from product/requirements.md");
  assert.ok(leaves.length > 0, "no leaf requirements computed");
});

test("every case is a `<slug>.<id>` module naming a real leaf", () => {
  const bad = [];
  for (const c of cases) {
    const m = PER_LEAF.exec(c.name);
    if (!m) bad.push(`${c.kind}/cases/${c.name} (not named <slug>.<id>.case.js)`);
    else if (!allIds.has(m[1])) bad.push(`${c.kind}/cases/${c.name} (${m[1]} is not in the spec)`);
  }
  assert.deepEqual(bad, [], "stray/misnamed cases:");
});

test("every leaf has exactly one case (strict bijection)", () => {
  const counts = {};
  for (const c of cases) {
    const id = leafIdOf(c.name);
    counts[id] = (counts[id] || 0) + 1;
  }
  const missing = leaves.filter((id) => !counts[id]);
  const dupes = Object.keys(counts).filter((id) => counts[id] > 1);
  assert.deepEqual(missing, [], "leaves with no <slug>.<id>.case.js:");
  assert.deepEqual(dupes, [], "leaves with more than one case:");
});

test("a case never claims a non-leaf requirement", () => {
  const leafSet = new Set(leaves);
  const bad = cases
    .map((c) => leafIdOf(c.name))
    .filter((id) => id && allIds.has(id) && !leafSet.has(id));
  assert.deepEqual(bad, [], "cases claiming a parent (non-leaf) requirement:");
});

test("every kind directory carries a descriptor (nothing invisible to the registry)", () => {
  const requirementsDir = __dirname;
  const undescribed = fs
    .readdirSync(requirementsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "shared" && !d.name.startsWith("."))
    .map((d) => d.name)
    .filter((name) => !KIND_NAMES.includes(name));
  assert.deepEqual(undescribed, [], "top-level dirs without a kind.js descriptor:");
  for (const kind of KINDS) {
    assert.ok(fs.existsSync(kind.casesDir), `${kind.name}/ has no cases/ directory`);
  }
});

test("a coded (non-image) kind's folder carries no PNG (a pixel can't verify a gesture or a rule)", () => {
  const bad = [];
  for (const kind of KINDS.filter((k) => !k.image)) {
    if (!fs.existsSync(kind.casesDir)) continue;
    for (const f of fs.readdirSync(kind.casesDir).filter((n) => n.endsWith(".png"))) {
      bad.push(`${kind.name}/cases/${f}`);
    }
  }
  assert.deepEqual(bad, [], "images inside coded kinds:");
});

test("every golden belongs to a case (no strays)", () => {
  const owned = new Set(cases.filter((c) => c.image).map((c) => path.basename(goldenPath(c))));
  const strays = [];
  for (const kind of KINDS.filter((k) => k.image)) {
    if (!fs.existsSync(kind.casesDir)) continue;
    for (const f of fs.readdirSync(kind.casesDir).filter((n) => n.endsWith(".png"))) {
      if (!owned.has(f)) strays.push(`${kind.name}/cases/${f}`);
    }
  }
  assert.deepEqual(strays, [], "golden PNGs no case accounts for:");
});
