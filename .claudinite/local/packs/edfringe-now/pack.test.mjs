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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import pack from "./pack.mjs";
import rule from "./test-globs-in-step.mjs";
import verifyShSourceDirsRule from "./verify-sh-source-dirs.mjs";
import noStrayPackageJsonRule from "./no-stray-package-json.mjs";
import workerRestoresMainRule from "./worker-restores-main.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");

/** The repo's real tracked files, for a live-gate test against actual content. */
function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

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
    "package.json": packageJson(`${GLOBS} .claudinite/local/packs/edfringe-now/tasks/*/*.test.mjs`),
    "scripts/verify.sh": verifyScript(GLOBS),
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-test-globs-in-step");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "scripts/verify.sh");
  assert.match(out[0].what, /drifted apart/);
  assert.match(out[0].what, /only in package\.json: \.claudinite\/local\/packs\/edfringe-now\/tasks\/\*\/\*\.test\.mjs/);
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

// --- verify-sh-source-dirs: scripts/verify.sh's syntax-check step must name
// every top-level directory that has committed .js/.mjs source ---

const verifyShWithDirs = (...dirs) =>
  `#!/usr/bin/env bash\nstep "JavaScript syntax — node --check"\n` +
  `js_files=$(git ls-files ${dirs.map((d) => `'${d}'`).join(" ")} | { grep -E '\\.m?js$' || true; })\n`;

test("every top-level source dir named in verify.sh ⇒ no findings", () => {
  const out = verifyShSourceDirsRule.run(ctxOf({
    "scripts/verify.sh": verifyShWithDirs("js", "plan", "scripts", "shared"),
    "js/app.js": "",
    "plan/plan.js": "",
    "scripts/release-tool.mjs": "",
    "shared/geo.js": "",
  }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a top-level dir with .mjs source left off the git ls-files list is reported", () => {
  // The exact regression this guards: a .mjs script shipped under scripts/ (#81)
  // while scripts/ was never added to verify.sh's syntax-check glob, so it was
  // never node --check'd in the pre-commit hook or in CI. The paths here are
  // synthetic — the rule is about any .mjs under a top-level source dir.
  const out = verifyShSourceDirsRule.run(ctxOf({
    "scripts/verify.sh": verifyShWithDirs("js", "plan", "shared"),
    "js/app.js": "",
    "scripts/release-tool.mjs": "",
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-verify-sh-covers-source-dirs");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "scripts/verify.sh");
  assert.match(out[0].what, /^scripts has committed \.js\/\.mjs files/);
  assert.match(out[0].fix, /add 'scripts' to the `git ls-files` call/);
});

test("multiple missing dirs are named together, sorted", () => {
  const out = verifyShSourceDirsRule.run(ctxOf({
    "scripts/verify.sh": verifyShWithDirs("plan"),
    "shared/geo.js": "",
    "js/app.js": "",
  }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /^js, shared /);
});

test("hidden dirs and bare top-level files are never flagged", () => {
  const out = verifyShSourceDirsRule.run(ctxOf({
    "scripts/verify.sh": verifyShWithDirs("js", "plan", "scripts", "shared"),
    ".claudinite/shared/engine/x.mjs": "",
    "build-info.js": "",
  }));
  assert.deepEqual(out, []);
});

test("no verify.sh in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(verifyShSourceDirsRule.run(ctxOf({ "shared/geo.js": "" })), []);
});

test("this repo's verify.sh covers every real top-level source dir", () => {
  // The live gate: every tracked file, read straight from git.
  const files = trackedFiles();
  const out = verifyShSourceDirsRule.run({
    files,
    read: (p) => (files.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `scripts/verify.sh is missing a source dir:\n${out.map((f) => f.what).join("\n")}`);
});

// --- no-stray-package-json: only the repo root and the grandfathered
// plan/package.json may carry one ---

test("only the allowed package.json files ⇒ no findings", () => {
  const out = noStrayPackageJsonRule.run(ctxOf({
    "package.json": "{}",
    "plan/package.json": "{}",
    "js/app.js": "",
  }));
  assert.deepEqual(out, []);
});

test("a package.json copied into a new source dir is reported", () => {
  const out = noStrayPackageJsonRule.run(ctxOf({
    "package.json": "{}",
    "plan/package.json": "{}",
    "shared/package.json": "{}",
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-no-stray-package-json");
  assert.equal(out[0].severity, "advisory");
  assert.equal(out[0].file, "shared/package.json");
  assert.match(out[0].fix, /remove it/);
});

test("more than one stray package.json is reported individually", () => {
  const out = noStrayPackageJsonRule.run(ctxOf({
    "js/package.json": "{}",
    "shared/package.json": "{}",
  }));
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((f) => f.file).sort(), ["js/package.json", "shared/package.json"]);
});

test("no package.json in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(noStrayPackageJsonRule.run(ctxOf({ "README.md": "hi" })), []);
});

test("this repo carries no stray package.json", () => {
  // The live gate: every tracked file, read straight from git.
  const files = trackedFiles();
  const out = noStrayPackageJsonRule.run({
    files,
    read: (p) => (files.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `stray package.json found:\n${out.map((f) => f.file).join("\n")}`);
});

// --- worker-restores-main: a local task worker that commits or pushes must
// return the shared checkout to `main` before it writes ---

const WORKER_PATH = ".claudinite/local/packs/edfringe-now/tasks/refresh-widgets/worker.sh";

const guard = `current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  git checkout main
fi
`;

const writes = `python3 scraper/refresh.py
git add data
git commit -m "Refresh"
git push
`;

test("a worker that restores main before writing ⇒ no findings", () => {
  const out = workerRestoresMainRule.run(ctxOf({ [WORKER_PATH]: `set -euo pipefail\n${guard}${writes}` }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a worker that pushes with no restore at all is reported", () => {
  // The exact regression this guards: #141 and #231, where the scheduler ran the
  // task after `basics/baselining` had left the one shared checkout on its
  // maintenance branch, and the bare push aborted with exit 128.
  const out = workerRestoresMainRule.run(ctxOf({ [WORKER_PATH]: `set -euo pipefail\n${writes}` }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-worker-restores-main");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, WORKER_PATH);
  assert.match(out[0].what, /without ever returning the checkout to `main`/);
  assert.match(out[0].fix, /git rev-parse --abbrev-ref HEAD/);
  assert.match(out[0].fix, /HEAD:main/, "the fix must warn off the refspec workaround");
});

test("a restore placed after the write is reported", () => {
  const out = workerRestoresMainRule.run(ctxOf({ [WORKER_PATH]: `set -euo pipefail\n${writes}${guard}` }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /only after it has already committed or pushed/);
});

test("`git switch main` satisfies the guard just as `git checkout main` does", () => {
  const swap = guard.replace("git checkout main", "git switch main");
  assert.deepEqual(workerRestoresMainRule.run(ctxOf({ [WORKER_PATH]: `${swap}${writes}` })), []);
});

test("a restore that only appears in a comment does not satisfy the guard", () => {
  const commented = `# Not \`git checkout main\`: see the note above.\n${writes}`;
  const out = workerRestoresMainRule.run(ctxOf({ [WORKER_PATH]: commented }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /without ever returning the checkout to `main`/);
});

test("a read-only worker is not this check's business (relevance-first)", () => {
  const out = workerRestoresMainRule.run(ctxOf({
    [WORKER_PATH]: "set -euo pipefail\npython3 scraper/report.py\n",
  }));
  assert.deepEqual(out, []);
});

test("non-worker scripts are never flagged", () => {
  const out = workerRestoresMainRule.run(ctxOf({
    "scripts/verify.sh": writes,
    ".github/workflows/prices.yml": writes,
    ".claudinite/local/packs/edfringe-now/tasks/refresh-widgets/task.mjs": writes,
  }));
  assert.deepEqual(out, []);
});

test("this repo's real task workers all restore main before writing", () => {
  // The live gate: every tracked file, read straight from git.
  const files = trackedFiles();
  const workers = files.filter((f) => /\/tasks\/[^/]+\/worker\.sh$/.test(f));
  assert.ok(workers.length > 0, "expected this repo to ship at least one task worker");

  const out = workerRestoresMainRule.run({
    files,
    read: (p) => (files.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `a task worker can push from the wrong branch:\n${out.map((f) => f.what).join("\n")}`);
});

test("the pack manifest declares the checks and stays hand-declared", () => {
  assert.equal(pack.id, "edfringe-now");
  assert.equal(pack.detect, null, "a local pack is never fingerprinted");
  assert.equal(pack.marker, null);
  assert.equal(pack.prose, "RULES.md");
  assert.ok(pack.worldRules.includes(rule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.worldRules.includes(verifyShSourceDirsRule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.worldRules.includes(noStrayPackageJsonRule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.worldRules.includes(workerRestoresMainRule), "the check must be listed on the manifest or it never runs");
  assert.ok(existsSync(path.join(__dirname, "RULES.md")));
});
