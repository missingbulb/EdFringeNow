// Red-first fixture for this pack's check, plus a guard on the pack manifest.
//
// The check reads its files through the engine's `ctx`, so the fixtures here are
// tiny in-memory contexts ({ files, read }) — no temp dirs, no mount, and the
// same shape the real runner passes (engine/checks/helpers/repo-context.mjs).
// The last test runs the rule against this repo's ACTUAL committed data, which
// is what makes the check a live gate rather than a self-fulfilling unit test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import pack from "./pack.mjs";
import rule from "./lookup-indices.mjs";
import selftestRule from "./normalizer-selftest-in-verify.mjs";
import dataDirRule from "./data-dir-is-generator-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");

/** A context over an in-memory {path: string} map, for the text-reading checks. */
function textCtx(tree) {
  const files = Object.keys(tree);
  return { files, read: (p) => (p in tree ? tree[p] : null) };
}

/** A context over real files on disk, for the live-gate tests. */
function diskCtx(paths) {
  const present = paths.filter((f) => existsSync(path.join(REPO, f)));
  return {
    present,
    ctx: {
      files: present,
      read: (p) => (present.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
    },
  };
}

const LOOKUPS = {
  venues: { "33": { name: "Pleasance Courtyard" } },
  rooms: ["Above", "Below"],
  genres: ["Comedy", "Theatre"],
  subgenres: ["Improv", "Stand-up"],
  ticketStatuses: ["SOLD_OUT", "TICKETS_AVAILABLE"],
  ageRestrictions: ["EIGHTEEN", "SIXTEEN"],
};

/** A context over an in-memory {path: object} map, matching the engine's ctx. */
function ctxOf(tree) {
  const files = Object.keys(tree);
  return {
    files,
    read: (p) => (p in tree ? JSON.stringify(tree[p]) : null),
  };
}

const cleanDay = [
  { id: "X", title: "A show", genre: 1, subs: [0, 1], venue: "33", room: 0, ts: 1 },
  // -1 is the producer's "unknown" for room and ticket status (normalize.py), not
  // an out-of-range index — the check must stay quiet on it.
  { id: "Y", title: "Another", genre: 0, subs: [], venue: "33", room: -1, ts: -1 },
];

test("clean day file + master produce no findings", () => {
  const out = rule.run(ctxOf({
    "data/venues.json": LOOKUPS,
    "data/days/2026-08-07.json": cleanDay,
    "data/normalized/shows.min.json": [
      { i: "X", t: "A show", g: 1, sg: [0], rm: 0, ar: 1, p: [{ t: 1 }] },
    ],
  }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a genre index past the end of venues.json genres is reported", () => {
  // The exact regression this guards: someone shrinks/reorders a lookup list (or
  // hand-edits a day file) and every affected card silently mislabels.
  const out = rule.run(ctxOf({
    "data/venues.json": LOOKUPS,
    "data/days/2026-08-07.json": [{ id: "X", title: "A show", genre: 7, venue: "33", room: 0, ts: 1 }],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-lookup-indices");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "data/days/2026-08-07.json");
  assert.match(out[0].what, /genre = 7 is outside venues\.json "genres"/);
  assert.ok(out[0].fix.includes("normalize.py"), "the fix must name the regeneration command");
});

test("out-of-range subgenre, room and ticket-status indices are reported too", () => {
  const out = rule.run(ctxOf({
    "data/venues.json": LOOKUPS,
    "data/days/2026-08-07.json": [
      { id: "X", title: "A", genre: 0, subs: [9], venue: "33", room: 0, ts: 1 },
      { id: "Y", title: "B", genre: 0, subs: [], venue: "33", room: 4, ts: 1 },
      { id: "Z", title: "C", genre: 0, subs: [], venue: "33", room: 0, ts: 5 },
    ],
  }));
  assert.equal(out.length, 3);
  assert.match(out[0].what, /subs\[\] = 9 is outside venues\.json "subgenres"/);
  assert.match(out[1].what, /room = 4 is outside venues\.json "rooms"/);
  assert.match(out[2].what, /ts = 5 is outside venues\.json "ticketStatuses"/);
});

test("the master's own keys (g / rm / ar / sg / p[].t) are checked", () => {
  const out = rule.run(ctxOf({
    "data/venues.json": LOOKUPS,
    "data/normalized/shows.min.json": [
      { i: "X", t: "A show", g: 0, sg: [3], rm: 0, ar: 0, p: [{ t: 1 }] },
      { i: "Y", t: "Bad status", g: 0, sg: [], rm: 0, ar: 0, p: [{ t: 9 }] },
    ],
  }));
  assert.equal(out.length, 2);
  assert.ok(out.every((f) => f.file === "data/normalized/shows.min.json"));
  assert.match(out[0].what, /sg\[\] = 3 is outside venues\.json "subgenres"/);
  assert.match(out[1].what, /p\[0\]\.t = 9 is outside venues\.json "ticketStatuses"/);
});

test("a non-integer index is reported rather than silently coerced", () => {
  const out = rule.run(ctxOf({
    "data/venues.json": LOOKUPS,
    "data/days/2026-08-07.json": [{ id: "X", title: "A", genre: "Comedy", venue: "33", room: 0, ts: 1 }],
  }));
  assert.equal(out.length, 1);
  assert.match(out[0].what, /genre is "Comedy", not an integer index/);
});

test("no data layer in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(rule.run(ctxOf({ "README.md": {} })), []);
});

test("this repo's committed data satisfies the invariant", () => {
  // The live gate: every real day file plus the master, read off disk.
  const tree = ["data/venues.json", "data/normalized/shows.min.json"];
  const days = readFileSync(path.join(REPO, "data/days/index.json"), "utf8");
  for (const d of JSON.parse(days).dates) tree.push(`data/days/${d}.json`);
  const present = tree.filter((f) => existsSync(path.join(REPO, f)));
  assert.ok(present.length > 2, "expected the committed day files to be present");

  const out = rule.run({
    files: present,
    read: (p) => (present.includes(p) ? readFileSync(path.join(REPO, p), "utf8") : null),
  });
  assert.deepEqual(out, [], `committed data violates the lookup-index contract:\n${
    out.map((f) => `${f.file}: ${f.what}`).join("\n")}`);
});

// --- normalizer-selftest-in-verify: the one offline transform check must stay
// wired into scripts/verify.sh ---

const NORMALIZER_PY = `import sys\nif "--selftest" in sys.argv:\n    run_selftest()\n`;

const verifyWithSelftest = `#!/usr/bin/env bash
set -euo pipefail

step "Normalizer self-test — normalize.py --selftest"
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/normalize.py --selftest
fi
`;

// The label survives; the invocation is gone. A grep for the two tokens passes
// here — which is precisely why the check strips `step "..."` before looking.
const verifyLabelOnly = `#!/usr/bin/env bash
set -euo pipefail

step "Normalizer self-test — normalize.py --selftest"
echo "skipped"
`;

test("verify.sh invoking the self-test ⇒ no findings", () => {
  const out = selftestRule.run(textCtx({
    "scraper/normalize.py": NORMALIZER_PY,
    "scripts/verify.sh": verifyWithSelftest,
  }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a verify.sh left with only the step label is reported", () => {
  // The exact regression this guards: the step is gutted, the heading stays, and
  // the only offline verification a scraper change can get silently disappears.
  const out = selftestRule.run(textCtx({
    "scraper/normalize.py": NORMALIZER_PY,
    "scripts/verify.sh": verifyLabelOnly,
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-normalizer-selftest-in-verify");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "scripts/verify.sh");
  assert.match(out[0].what, /never invokes it/);
  assert.ok(out[0].fix.includes("--selftest"), "the fix must name the command to restore");
});

test("a commented-out invocation does not count as wired", () => {
  const out = selftestRule.run(textCtx({
    "scraper/normalize.py": NORMALIZER_PY,
    "scripts/verify.sh": `#!/usr/bin/env bash\n# python3 scraper/normalize.py --selftest\necho hi\n`,
  }));
  assert.equal(out.length, 1);
});

test("a trailing comment naming the command does not count as wired", () => {
  const out = selftestRule.run(textCtx({
    "scraper/normalize.py": NORMALIZER_PY,
    "scripts/verify.sh": `#!/usr/bin/env bash\nnode --check js/app.js  # unlike normalize.py --selftest, this is syntax only\n`,
  }));
  assert.equal(out.length, 1);
});

test("a normalizer with no --selftest to run ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(selftestRule.run(textCtx({
    "scraper/normalize.py": "def main():\n    pass\n",
    "scripts/verify.sh": verifyLabelOnly,
  })), []);
});

test("no normalizer or no verify.sh in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(selftestRule.run(textCtx({ "scripts/verify.sh": verifyLabelOnly })), []);
  assert.deepEqual(selftestRule.run(textCtx({ "scraper/normalize.py": NORMALIZER_PY })), []);
});

test("this repo's verify.sh still runs the normalizer self-test", () => {
  // The live gate: the real script and the real normalizer, read off disk.
  const { present, ctx } = diskCtx(["scraper/normalize.py", "scripts/verify.sh"]);
  assert.equal(present.length, 2, "expected both files to be present");
  const out = selftestRule.run(ctx);
  assert.deepEqual(out, [], `the offline transform check has fallen out of the gate:\n${
    out.map((f) => f.what).join("\n")}`);
});

// --- data-dir-is-generator-output: every committed file under data/ must be
// something scraper/normalize.py produces ---

const cleanDataTree = {
  "data/venues.json": "",
  "data/shows.json": "",
  "data/normalized/shows.json": "",
  "data/normalized/shows.min.json": "",
  "data/normalized/descriptions.min.json": "",
  "data/days/index.json": "",
  "data/days/2026-08-07.json": "",
  "js/app.js": "",
};

test("a data/ holding only normalizer output ⇒ no findings", () => {
  const out = dataDirRule.run(textCtx(cleanDataTree));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a probe's output committed under data/ is reported", () => {
  // The exact regression this guards: a throwaway probe's answer is parked in
  // data/ as if it were data, where nothing regenerates it and the next
  // refresh-shows run neither maintains nor removes it.
  const out = dataDirRule.run(textCtx({ ...cleanDataTree, "data/ticket-status-enum.json": "" }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-data-dir-is-generator-output");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "data/ticket-status-enum.json");
  assert.match(out[0].what, /is not something scraper\/normalize\.py produces/);
  assert.ok(out[0].fix.includes("normalize.py"), "the fix must name the producer to fix instead");
});

test("a force-added raw scrape cache file gets its own un-track fix", () => {
  const out = dataDirRule.run(textCtx({ ...cleanDataTree, "data/raw_pages/events_1.json": "" }));
  assert.equal(out.length, 1);
  assert.equal(out[0].file, "data/raw_pages/events_1.json");
  assert.match(out[0].fix, /git rm --cached data\/raw_pages\/events_1\.json/);
});

test("a hand-written note dropped beside the normalized files is reported", () => {
  const out = dataDirRule.run(textCtx({ ...cleanDataTree, "data/normalized/NOTES.md": "" }));
  assert.equal(out.length, 1);
  assert.equal(out[0].file, "data/normalized/NOTES.md");
});

test("a whole new output directory is reported, per file, sorted", () => {
  const out = dataDirRule.run(textCtx({
    ...cleanDataTree,
    "data/weeks/2026-w32.json": "",
    "data/hand/notes.json": "",
  }));
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((f) => f.file), ["data/hand/notes.json", "data/weeks/2026-w32.json"]);
});

test("no data/ in the tree ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(dataDirRule.run(textCtx({ "README.md": "hi", "scraper/normalize.py": "" })), []);
});

test("this repo's committed data/ holds only generator output", () => {
  // The live gate: every tracked file, read straight from git.
  const files = execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);
  const out = dataDirRule.run({ files, read: () => null });
  assert.deepEqual(out, [], `data/ holds something the normalizer does not produce:\n${
    out.map((f) => `${f.file}: ${f.what}`).join("\n")}`);
});

test("the pack manifest declares the checks and stays hand-declared", () => {
  assert.equal(pack.id, "edfringe-data");
  assert.equal(pack.detect, null, "a local pack is never fingerprinted");
  assert.equal(pack.marker, null);
  assert.equal(pack.prose, "RULES.md");
  assert.ok(pack.worldRules.includes(rule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.worldRules.includes(selftestRule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.worldRules.includes(dataDirRule), "the check must be listed on the manifest or it never runs");
  assert.ok(existsSync(path.join(__dirname, "RULES.md")));
});
