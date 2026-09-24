// The shared shell helpers the fetching tasks' workers source: how an operator
// parameter is read off the item's Context, and how a rejected push recovers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker-lib.sh");
const bash = (script, { cwd, env = {} } = {}) =>
  execFileSync("bash", ["-c", `set -euo pipefail; source "${LIB}"; ${script}`], {
    cwd, encoding: "utf8", env: { ...process.env, ...env },
  });

test("context_param reads a Context bullet in either spelling, else the default", () => {
  const env = { CLAUDINITE_CONTEXT: "- per: 25\n  min_delay=2 \nslug: daniel-sloss-bitter\ncommit: false" };
  const read = (key, def) => bash(`context_param ${key} '${def}'`, { env });
  assert.equal(read("per", "50"), "25");
  assert.equal(read("min_delay", "4"), "2");
  assert.equal(read("slug", ""), "daniel-sloss-bitter");
  assert.equal(read("commit", "true"), "false");
  assert.equal(read("max_delay", "9"), "9");
  assert.equal(bash("context_param per 50", { env: { CLAUDINITE_CONTEXT: "" } }), "50");
});

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function clone(remote, dir) {
  execFileSync("git", ["clone", "-q", remote, dir]);
  git(dir, "config", "user.name", "t");
  git(dir, "config", "user.email", "t@example.com");
}

test("commit_regenerated re-derives onto main when its push is rejected", () => {
  const root = mkdtempSync(path.join(tmpdir(), "worker-lib-"));
  const remote = path.join(root, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
  const seed = path.join(root, "seed");
  clone(remote, seed);
  git(seed, "checkout", "-q", "-b", "main");
  for (const d of ["data/normalized", "site/data"]) mkdirSync(path.join(seed, d), { recursive: true });
  writeFileSync(path.join(seed, "data/normalized/shows.json"), "v0\n");
  writeFileSync(path.join(seed, "site/data/out.json"), "v0\n");
  writeFileSync(path.join(seed, "data/input.json"), "in0\n");
  git(seed, "add", "-A"); git(seed, "commit", "-q", "-m", "seed"); git(seed, "push", "-q", "origin", "main");

  const run = path.join(root, "run");
  clone(remote, run);
  // This run's own input moves, and so does its generated output.
  writeFileSync(path.join(run, "data/input.json"), "in1\n");
  writeFileSync(path.join(run, "site/data/out.json"), "ours\n");

  // Meanwhile another writer pushes generated data to main.
  git(seed, "pull", "-q");
  writeFileSync(path.join(seed, "data/normalized/shows.json"), "theirs\n");
  git(seed, "commit", "-qam", "refresh"); git(seed, "push", "-q");

  // The "generator": derives site/data from the master plus this run's input.
  const regen = path.join(root, "regen.sh");
  writeFileSync(regen, 'cat data/normalized/shows.json data/input.json > site/data/out.json\n');
  const out = bash(`commit_regenerated "update" "bash ${regen}" data/input.json data/normalized site/data`, { cwd: run });
  assert.match(out, /push rejected on attempt 1/);
  assert.match(out, /pushed on attempt 2/);

  const check = path.join(root, "check");
  clone(remote, check);
  assert.equal(readFileSync(path.join(check, "data/normalized/shows.json"), "utf8"), "theirs\n");
  assert.equal(readFileSync(path.join(check, "data/input.json"), "utf8"), "in1\n");
  assert.equal(readFileSync(path.join(check, "site/data/out.json"), "utf8"), "theirs\nin1\n");
});
