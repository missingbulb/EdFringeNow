// Red-first fixture for this pack's check, plus a guard on the pack manifest.
//
// The check reads its files through the engine's `ctx`, so the fixtures here are
// tiny in-memory contexts ({ files, read }) — no temp dirs, no mount, and the
// same shape the real runner passes (engine/checks/helpers/repo-context.mjs).
// The last test runs it against this repo's ACTUAL case files, which is what
// makes the check a live gate rather than a self-fulfilling unit test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import pack from "./pack.mjs";
import rule from "./case-no-live-data-dir.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");

/** A context over an in-memory {path: string} map, matching the engine's ctx. */
function ctxOf(tree) {
  const files = Object.keys(tree);
  return { files, read: (p) => (p in tree ? tree[p] : null) };
}

const cleanCase = `module.exports = {
  name: "now-empty-state",
  description: "the catalogue empty state",
  page: "/",
  capture: ".now-empty",
};
`;

test("a case with no dataDir ⇒ no findings", () => {
  const out = rule.run(ctxOf({
    "product/requirements/screen/cases/now.1.1.case.js": cleanCase,
  }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a case declaring its own dataDir is reported", () => {
  // The exact regression this guards: a case reaches around the frozen
  // shared/fixtures/data snapshot at the live, nightly-refreshed data/ files —
  // sanctioned today only because no runner forwards a case's dataDir at all,
  // but the one surface through which that bypass would work the moment one does.
  const badCase = `module.exports = {
  name: "now-empty-state",
  page: "/",
  dataDir: require("path").join(__dirname, "..", "..", "..", "..", "data"),
  capture: ".now-empty",
};
`;
  const out = rule.run(ctxOf({
    "product/requirements/screen/cases/now.1.1.case.js": badCase,
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-requirements-case-no-live-data-dir");
  assert.equal(out[0].severity, "advisory");
  assert.equal(out[0].file, "product/requirements/screen/cases/now.1.1.case.js");
  assert.match(out[0].what, /declares its own `dataDir`/);
  assert.ok(out[0].fix.includes("shared/fixtures/data"), "the fix must name the frozen snapshot to use instead");
});

test("dataDir mentioned only in a comment is not flagged", () => {
  const out = rule.run(ctxOf({
    "product/requirements/logic/cases/planner.3.1.case.js": `// never set dataDir here — see RULES.md\nmodule.exports = { name: "x", verify() {} };\n`,
  }));
  assert.deepEqual(out, []);
});

test("dataDir in a non-case file (the harness itself) is out of scope", () => {
  const out = rule.run(ctxOf({
    "product/requirements/shared/harness/browser.js": "async function routeAll(context, { dataDir, failData }) {}\n",
  }));
  assert.deepEqual(out, []);
});

test("behavior and logic cases are covered too, not just screen", () => {
  const badCase = `module.exports = { name: "x", dataDir: "/tmp/x", verify() {} };\n`;
  const out = rule.run(ctxOf({
    "product/requirements/behavior/cases/now.2.1.case.js": badCase,
    "product/requirements/logic/cases/planner.3.1.case.mjs": badCase,
  }));
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((f) => f.file), [
    "product/requirements/behavior/cases/now.2.1.case.js",
    "product/requirements/logic/cases/planner.3.1.case.mjs",
  ]);
});

test("no case files in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(rule.run(ctxOf({ "README.md": "hi" })), []);
});

test("this repo's committed case files declare no dataDir override", () => {
  // The live gate: every tracked file, read straight from git.
  const files = execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const caseFiles = files.filter((f) => /^product\/requirements\/(screen|logic|behavior)\/cases\/[^/]+\.case\.(js|mjs)$/.test(f));
  assert.ok(caseFiles.length > 3, "expected the committed case files to be present");

  const out = rule.run({
    files,
    read: (p) => (files.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `a committed case declares its own dataDir:\n${out.map((f) => f.file).join("\n")}`);
});

test("the pack manifest declares the check and stays hand-declared", () => {
  assert.equal(pack.id, "edfringe-requirements");
  assert.equal(pack.detect, null, "a local pack is never fingerprinted");
  assert.equal(pack.marker, null);
  assert.equal(pack.prose, "RULES.md");
  assert.ok(pack.worldRules.includes(rule), "the check must be listed on the manifest or it never runs");
  assert.ok(existsSync(path.join(__dirname, "RULES.md")));
});
