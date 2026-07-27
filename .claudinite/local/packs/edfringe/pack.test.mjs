// Red-first fixtures for this pack's check, plus a guard on the pack manifest.
//
// The check reads its files through the engine's `ctx`, so the fixtures here are
// tiny in-memory contexts ({ files, read }) — no temp dirs, no mount, and the
// same shape the real runner passes (engine/checks/helpers/repo-context.mjs).
// The last rule test runs it against this repo's ACTUAL package.json and
// scripts/verify.sh, which is what makes the check a live gate rather than a
// self-fulfilling unit test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import pack from "./pack.mjs";
import rule from "./test-globs-in-step.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");

const GLOBS = "plan/lib/__tests__/*.test.mjs .claudinite/local/packs/*/*.test.mjs";

/** A context over an in-memory {path: string} map, matching the engine's ctx. */
function ctxOf(tree) {
  const files = Object.keys(tree);
  return { files, read: (p) => (p in tree ? tree[p] : null) };
}

const verifyScript = (globs) => `#!/usr/bin/env bash
set -euo pipefail

step "Unit tests — node --test"
# Keep in step with the "test" script in package.json.
node --test ${globs}

step "JavaScript syntax — node --check"
`;

const packageJson = (globs) =>
  JSON.stringify({ name: "edfringenow", scripts: { test: `node --test ${globs}`, verify: "bash scripts/verify.sh" } });

test("identical glob lists produce no findings", () => {
  const out = rule.run(ctxOf({
    "package.json": packageJson(GLOBS),
    "scripts/verify.sh": verifyScript(GLOBS),
  }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("the same globs in a different order still pass", () => {
  const out = rule.run(ctxOf({
    "package.json": packageJson(".claudinite/local/packs/*/*.test.mjs plan/lib/__tests__/*.test.mjs"),
    "scripts/verify.sh": verifyScript(GLOBS),
  }));
  assert.deepEqual(out, []);
});

test("a glob added to package.json but not to verify.sh is reported", () => {
  // The exact regression this guards: a new local pack's pack.test.mjs is wired
  // into `npm test`, the verify.sh copy is forgotten, and CI never runs it.
  const out = rule.run(ctxOf({
    "package.json": packageJson(`${GLOBS} .claudinite/local/packs/edfringe/tasks/*/*.test.mjs`),
    "scripts/verify.sh": verifyScript(GLOBS),
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-test-globs-in-step");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "scripts/verify.sh");
  assert.match(out[0].what, /drifted apart/);
  assert.match(out[0].what, /only in package\.json: \.claudinite\/local\/packs\/edfringe\/tasks\/\*\/\*\.test\.mjs/);
  assert.ok(out[0].fix.includes("npm test"), "the fix must name the single-source escape hatch");
});

test("a glob added to verify.sh but not to package.json is reported", () => {
  const out = rule.run(ctxOf({
    "package.json": packageJson(GLOBS),
    "scripts/verify.sh": verifyScript(`${GLOBS} scraper/__tests__/*.test.mjs`),
  }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /only in scripts\/verify\.sh: scraper\/__tests__\/\*\.test\.mjs/);
});

test("verify.sh dropping `node --test` entirely is reported", () => {
  const out = rule.run(ctxOf({
    "package.json": packageJson(GLOBS),
    "scripts/verify.sh": "#!/usr/bin/env bash\nset -euo pipefail\nnode --check js/app.js\n",
  }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /runs no unit tests at all/);
});

test("verify.sh delegating to `npm test` is single-sourced, so the check stands down", () => {
  const out = rule.run(ctxOf({
    "package.json": packageJson(GLOBS),
    "scripts/verify.sh": "#!/usr/bin/env bash\nset -euo pipefail\nnpm test\n",
  }));
  assert.deepEqual(out, []);
});

test("a tree missing either file ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(rule.run(ctxOf({ "package.json": packageJson(GLOBS) })), []);
  assert.deepEqual(rule.run(ctxOf({ "scripts/verify.sh": verifyScript(GLOBS) })), []);
  assert.deepEqual(rule.run(ctxOf({ "README.md": "hi" })), []);
});

test("a package.json with no test script is not this check's business", () => {
  assert.deepEqual(rule.run(ctxOf({
    "package.json": JSON.stringify({ scripts: {} }),
    "scripts/verify.sh": verifyScript(GLOBS),
  })), []);
});

test("this repo's own package.json and verify.sh are in step", () => {
  // The live gate: the real files, read off disk.
  const present = ["package.json", "scripts/verify.sh"].filter((f) => existsSync(path.join(REPO, f)));
  assert.equal(present.length, 2, "expected both files to be present");

  const out = rule.run({
    files: present,
    read: (p) => (present.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `the test globs have drifted:\n${out.map((f) => f.what).join("\n")}`);
});

test("the pack manifest declares the check and stays hand-declared", () => {
  assert.equal(pack.id, "edfringe");
  assert.equal(pack.detect, null, "a local pack is never fingerprinted");
  assert.equal(pack.marker, null);
  assert.equal(pack.prose, "RULES.md");
  assert.ok(pack.rules.includes(rule), "the check must be listed on the manifest or it never runs");
  assert.ok(existsSync(path.join(__dirname, "RULES.md")));
});
