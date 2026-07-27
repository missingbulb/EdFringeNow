// Red-first fixtures for this pack's checks, plus a guard on the pack manifest.
//
// The checks read their files through the engine's `ctx`, so the fixtures here
// are tiny in-memory contexts ({ files, read }) — no temp dirs, no mount, and the
// same shape the real runner passes (engine/checks/helpers/repo-context.mjs).
// Each check's last fixture runs it against this repo's ACTUAL files (package.json
// + scripts/verify.sh; js/app.js + plan/plan.js), which is what makes them live
// gates rather than self-fulfilling unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import pack from "./pack.mjs";
import rule from "./test-globs-in-step.mjs";
import mirrors from "./cross-page-mirrors.mjs";

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

// ---------------------------------------------------------------------------
// edfringe-cross-page-mirrors — the Now page and the planner share no code, so a
// value both must agree on lives as two copies (RULES.md, "two independent
// front-ends"). These fixtures prove the check tells a real difference in the
// values from a merely different-looking copy.
// ---------------------------------------------------------------------------

const APP = "js/app.js";
const PLAN = "plan/plan.js";

const APP_COPY = `
/* Very rough bounding box for the UK mainland (lat/lng).
 * MIRRORED in plan/plan.js — change both or the two pages disagree. */
const UK_BOUNDS = { minLat: 49.8, maxLat: 59.0, minLng: -8.2, maxLng: 1.9 };

function isInUK([lat, lng]) {
  return lat >= UK_BOUNDS.minLat && lat <= UK_BOUNDS.maxLat;
}
`;

// Deliberately not byte-identical to APP_COPY: a different comment, different
// wrapping, and a different key order. None of that is drift.
const PLAN_COPY = `
// Very rough UK-mainland bounding box (mirrors js/app.js).
const UK_BOUNDS = {
  maxLat: 59.0,
  minLat: 49.8,
  minLng: -8.2,
  maxLng: 1.9,
};
`;

test("identical mirrors produce no findings, whatever the formatting", () => {
  const out = mirrors.run(ctxOf({ [APP]: APP_COPY, [PLAN]: PLAN_COPY }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a mirrored value changed on one page only is reported", () => {
  // The exact regression this guards: the box is widened on the Now page and the
  // planner keeps gating its debug menu on the old one.
  const out = mirrors.run(ctxOf({
    [APP]: APP_COPY,
    [PLAN]: PLAN_COPY.replace("maxLat: 59.0", "maxLat: 61.0"),
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-cross-page-mirrors");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, PLAN);
  assert.match(out[0].what, /UK_BOUNDS differs between the two front-ends/);
  assert.match(out[0].what, /maxLat: 59 in js\/app\.js vs 61 in plan\/plan\.js/);
  assert.ok(out[0].fix.includes(APP) && out[0].fix.includes(PLAN), "the fix must name both copies");
});

test("a key added to one copy only is reported", () => {
  const out = mirrors.run(ctxOf({
    [APP]: APP_COPY.replace("minLng: -8.2,", "minLng: -8.2, maxAlt: 2,"),
    [PLAN]: PLAN_COPY,
  }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /maxAlt: 2 in js\/app\.js vs \(absent\) in plan\/plan\.js/);
});

test("the constant disappearing from one page is reported, from both is not", () => {
  const dropped = mirrors.run(ctxOf({ [APP]: APP_COPY, [PLAN]: "// planner, no bounds here\n" }));
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].what, /declared in js\/app\.js but not in plan\/plan\.js/);
  assert.equal(dropped[0].file, APP);

  // Removed on purpose from both pages: there is no mirror left to disagree.
  assert.deepEqual(mirrors.run(ctxOf({ [APP]: "// nothing\n", [PLAN]: "// nothing\n" })), []);
});

test("a mention outside the declaration is not mistaken for a copy", () => {
  // Grep would match this comment; parsing the declaration does not.
  const out = mirrors.run(ctxOf({
    [APP]: APP_COPY,
    [PLAN]: `${PLAN_COPY}\n// see UK_BOUNDS = { minLat: 0 } in js/app.js for the real box\n`,
  }));
  assert.deepEqual(out, []);
});

test("only one of the two pages in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(mirrors.run(ctxOf({ [APP]: APP_COPY })), []);
  assert.deepEqual(mirrors.run(ctxOf({ "README.md": "# hi" })), []);
});

test("this repo's two front-ends agree", () => {
  // The live gate: the real files off disk.
  const files = [APP, PLAN];
  assert.ok(files.every((f) => existsSync(path.join(REPO, f))), "expected both front-ends to be present");
  const out = mirrors.run({
    files,
    read: (p) => (files.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `the two pages disagree:\n${out.map((f) => `${f.file}: ${f.what}`).join("\n")}`);
});

test("the pack manifest declares both checks and stays hand-declared", () => {
  assert.equal(pack.id, "edfringe");
  assert.equal(pack.detect, null, "a local pack is never fingerprinted");
  assert.equal(pack.marker, null);
  assert.equal(pack.prose, "RULES.md");
  assert.ok(pack.rules.includes(rule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.rules.includes(mirrors), "the check must be listed on the manifest or it never runs");
  assert.ok(existsSync(path.join(__dirname, "RULES.md")));
});
