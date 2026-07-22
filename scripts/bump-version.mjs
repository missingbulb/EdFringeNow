#!/usr/bin/env node
//
// Bump the app version for a production deploy.
//
// Scheme: 1.<mmdd>.<previous patch + 1>
//   - major  stays 1
//   - minor  is the deploy date as zero-padded month+day (Asia/Jerusalem, the
//            same timezone the deploy stamps its build time in)
//   - patch  is a monotonic counter: the previous patch value + 1, so it always
//            advances even when the day (and therefore the minor) rolls over
//
// package.json stays the single source of truth for the version — the deploy
// workflow runs this, then commits the bumped package.json back to main.
//
// Prints the new version to stdout (nothing else) so the workflow can capture it.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

// The current patch is the third dotted component; treat anything unparseable
// (e.g. the initial "1.0.0") as 0 so the first bump lands on patch 1.
const prevPatch = Number.parseInt(String(pkg.version ?? "").split(".")[2], 10);
const newPatch = (Number.isFinite(prevPatch) ? prevPatch : 0) + 1;

// mmdd in Asia/Jerusalem. en-CA gives a stable zero-padded MM and DD.
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const mm = parts.find((p) => p.type === "month").value;
const dd = parts.find((p) => p.type === "day").value;

const newVersion = `1.${mm}${dd}.${newPatch}`;
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(newVersion);
