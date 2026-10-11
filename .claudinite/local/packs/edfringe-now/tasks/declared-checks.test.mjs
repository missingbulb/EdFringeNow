// See-it-fail proof for this pack's declared world checks: each is run by the
// repo's pinned engine over a throwaway tree holding one violating and one clean
// source, so a check that cannot find its violation fails here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const cn = path.join(repo, ".claudinite/bin/cn");

function findingsFor(sourceText) {
  const tree = mkdtempSync(path.join(tmpdir(), "declared-check-"));
  try {
    cpSync(path.join(repo, ".claudinite"), path.join(tree, ".claudinite"), { recursive: true });
    mkdirSync(path.join(tree, "product/requirements/shared"), { recursive: true });
    writeFileSync(path.join(tree, "product/requirements/shared/ready.js"), sourceText);
    const git = (...a) => execFileSync("git", a, { cwd: tree, stdio: "ignore" });
    git("init", "-q");
    git("add", "-A");
    try {
      return execFileSync(cn, ["check", "--pack", "edfringe-now", "--repo", tree], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      return `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

const finding = /(?:advisory|blocking) edfringe-now\/edfringe-no-networkidle-in-requirements /;

test("a harness source waiting on networkidle is found", () => {
  assert.match(findingsFor('await page.waitForLoadState("networkidle");\n'), finding);
});

test("a harness source waiting on settled state is not", () => {
  assert.doesNotMatch(findingsFor("await page.evaluate(() => document.fonts.ready);\n"), finding);
});
