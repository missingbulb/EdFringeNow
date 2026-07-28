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
import { fileURLToPath } from "node:url";
import path from "node:path";

import pack from "./pack.mjs";
import rule from "./lookup-indices.mjs";
import decoderKeys from "./day-file-decoder-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");

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

/* ---------- edfringe-day-file-decoder-keys ---------- */
// Red-first fixtures for the producer/decoder key agreement. `ctxOf` above
// JSON-stringifies its values, so these build their own context: js/app.js is
// source text, not JSON.

/** A context over an in-memory {path: string} map of raw file text. */
function textCtx(tree) {
  const files = Object.keys(tree);
  return { files, read: (p) => (p in tree ? tree[p] : null) };
}

/** A miniature js/app.js whose adaptShow reads exactly `keys` off its record. */
function appWith(keys, { extra = "", inBody = "" } = {}) {
  return `
/* Doc comment above the function names fields in prose: entry.genre, entry.ts.
 * It must NOT count as a read — the check scopes to the body. */
function adaptShow(entry, { venues, rooms }, index) {
  ${inBody}
  return {
${keys.map((k) => `    ${k}: entry.${k},`).join("\n")}
  };
}
${extra}
`;
}

const DAY = "data/days/2026-08-07.json";
const ALL_KEYS = ["id", "title", "genre", "subs", "venue", "room", "start", "duration", "free", "soldOut", "ts", "slug"];
const dayRecords = (rec) => JSON.stringify([rec]);
const fullRecord = {
  id: "X", title: "A show", genre: 1, subs: [0], venue: "33", room: 0,
  start: "19:30", duration: 60, free: 0, soldOut: 0, ts: 1, slug: "a-show",
};

test("decoder reading only fields the day files carry ⇒ no findings", () => {
  const out = decoderKeys.run(textCtx({
    "js/app.js": appWith(ALL_KEYS),
    [DAY]: dayRecords(fullRecord),
  }));
  assert.deepEqual(out, [], `expected no findings, got ${JSON.stringify(out, null, 2)}`);
});

test("a field dropped by the producer but still read by adaptShow is reported", () => {
  // The exact regression: normalize.py stops writing `ts`, the day files are
  // regenerated, and adaptShow keeps reading it — availability silently degrades
  // to "unknown ⇒ available" for every show, with no test or parse error.
  const { ts, ...withoutTs } = fullRecord;
  const out = decoderKeys.run(textCtx({
    "js/app.js": appWith(ALL_KEYS),
    [DAY]: dayRecords(withoutTs),
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].rule, "edfringe-day-file-decoder-keys");
  assert.equal(out[0].severity, "blocking");
  assert.equal(out[0].file, "js/app.js");
  assert.match(out[0].what, /adaptShow reads `entry\.ts`, but no committed day file record has a "ts" field/);
  assert.ok(out[0].fix.includes("normalize.py"), "the fix must name the producer");
});

test("a field renamed on the producer side is reported once per stale read", () => {
  const { subs, genre, ...renamed } = fullRecord;
  const out = decoderKeys.run(textCtx({
    "js/app.js": appWith(ALL_KEYS),
    [DAY]: dayRecords({ ...renamed, subgenres: [0], genreIx: 1 }),
  }));
  assert.deepEqual(out.map((f) => f.what.match(/entry\.(\w+)/)[1]), ["genre", "subs"]);
});

test("field names mentioned in a comment inside the body are not reads", () => {
  // Parsing, not grepping: prose naming a field must not invent a violation.
  const out = decoderKeys.run(textCtx({
    "js/app.js": appWith(["id"], { inBody: "// legacy: entry.price and entry.blurb were dropped in 2026\n  /* entry.hostPrefix too */" }),
    [DAY]: dayRecords({ id: "X" }),
  }));
  assert.deepEqual(out, [], `comment mentions must not fire: ${JSON.stringify(out)}`);
});

test("an `entry.` read in a different function is out of scope", () => {
  const out = decoderKeys.run(textCtx({
    "js/app.js": appWith(["id"], { extra: "function adaptVenue(entry) { return entry.notADayFileField; }" }),
    [DAY]: dayRecords({ id: "X" }),
  }));
  assert.deepEqual(out, [], `only adaptShow's body counts: ${JSON.stringify(out)}`);
});

test("the key union spans every day file, so an optional field is not a violation", () => {
  // `room` appears on only one of the two days; that is sparse data, not drift.
  const out = decoderKeys.run(textCtx({
    "js/app.js": appWith(["id", "room"]),
    "data/days/2026-08-07.json": dayRecords({ id: "X" }),
    "data/days/2026-08-08.json": dayRecords({ id: "Y", room: 0 }),
  }));
  assert.deepEqual(out, [], `union across day files: ${JSON.stringify(out)}`);
});

test("no js/app.js, no adaptShow, or no day records ⇒ no findings (relevance-first)", () => {
  assert.deepEqual(decoderKeys.run(textCtx({ [DAY]: dayRecords(fullRecord) })), []);
  assert.deepEqual(decoderKeys.run(textCtx({ "js/app.js": "function other() {}", [DAY]: dayRecords(fullRecord) })), []);
  // A fresh checkout with the data not yet generated must stay quiet rather than
  // reporting every field the decoder reads.
  assert.deepEqual(decoderKeys.run(textCtx({ "js/app.js": appWith(ALL_KEYS) })), []);
  assert.deepEqual(decoderKeys.run(textCtx({ "js/app.js": appWith(ALL_KEYS), [DAY]: "[]" })), []);
});

test("this repo's real js/app.js agrees with its real day files", () => {
  // The live gate: the actual decoder read against the actual committed wire data.
  const tree = { "js/app.js": readFileSync(path.join(REPO, "js/app.js"), "utf8") };
  for (const d of JSON.parse(readFileSync(path.join(REPO, "data/days/index.json"), "utf8")).dates) {
    const rel = `data/days/${d}.json`;
    if (existsSync(path.join(REPO, rel))) tree[rel] = readFileSync(path.join(REPO, rel), "utf8");
  }
  assert.ok(Object.keys(tree).length > 2, "expected the committed day files to be present");
  const out = decoderKeys.run(textCtx(tree));
  assert.deepEqual(out, [], `js/app.js reads day-file fields the data does not carry:\n${
    out.map((f) => f.what).join("\n")}`);
});

test("the pack manifest declares both checks and stays hand-declared", () => {
  assert.equal(pack.id, "edfringe-data");
  assert.equal(pack.detect, null, "a local pack is never fingerprinted");
  assert.equal(pack.marker, null);
  assert.equal(pack.prose, "RULES.md");
  assert.ok(pack.rules.includes(rule), "the check must be listed on the manifest or it never runs");
  assert.ok(pack.rules.includes(decoderKeys), "the check must be listed on the manifest or it never runs");
  assert.ok(existsSync(path.join(__dirname, "RULES.md")));
});
