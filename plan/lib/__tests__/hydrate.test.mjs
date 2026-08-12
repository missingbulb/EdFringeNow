// Tests for the compact-catalogue rehydration (plan/lib/hydrate.js), the client
// half of the shows.min.json minification. The headline test round-trips the
// REAL committed artifacts: it packs nothing itself but asserts that the
// shipped shows.min.json, unpacked against the shipped venues.json AND the
// shipped availability.min.json, reproduces the master shows.json exactly — so
// any drift between scraper/normalize.py's packer and this unpacker (or a stale
// wire file) fails the build.
//
// That the round-trip needs all three files is the point of the split: ticket
// status lives in the sidecar so the catalogue can be cached for days
// (shared/data-cache.js), and this test is what keeps the join honest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { imageUrl, mmddToDate, performanceKeys, performanceAvailability, rehydrateShows, joinFingerprint } from "../hydrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "..", "..", "data");
const master = JSON.parse(readFileSync(path.join(DATA, "normalized", "shows.json"), "utf-8"));
const wire = JSON.parse(readFileSync(path.join(DATA, "normalized", "shows.min.json"), "utf-8"));
const lookups = JSON.parse(readFileSync(path.join(DATA, "venues.json"), "utf-8"));
const descriptions = JSON.parse(
  readFileSync(path.join(DATA, "normalized", "descriptions.min.json"), "utf-8"));
const availability = JSON.parse(
  readFileSync(path.join(DATA, "normalized", "availability.min.json"), "utf-8"));

const YEAR = 2026;

// The intended client record is the master with image/smallImage resolved to
// absolute https urls — the client always renders imageUrl(image), so that
// transform is intended, not loss.
//
// `description` is the one field the packer deliberately leaves behind: it is
// the bulkiest thing a show carries and ships in its own sidecar
// (descriptions.min.json), so the catalogue never carries it and rehydration
// can never produce it. Dropping it here is not a hole in the round-trip — the
// test below asserts the sidecar carries every description the master has.
function expected(show) {
  const { description, ...rest } = show;
  return { ...rest, image: imageUrl(show.image), smallImage: imageUrl(show.smallImage) };
}

test("shows.min.json rehydrates byte-identical to the master shows.json", () => {
  const rehydrated = rehydrateShows(wire, lookups, YEAR, availability);
  assert.equal(rehydrated.length, master.length, "show count must match");

  let mismatches = 0;
  let firstBad = null;
  for (let i = 0; i < master.length; i++) {
    const e = JSON.stringify(expected(master[i]));
    const r = JSON.stringify(rehydrated[i]);
    if (e !== r) {
      mismatches++;
      if (!firstBad) firstBad = { i, id: master[i].id, expected: e.slice(0, 200), got: r.slice(0, 200) };
    }
  }
  assert.equal(mismatches, 0,
    `every show must round-trip losslessly; first mismatch: ${JSON.stringify(firstBad)}`);
});

// The other half of the round-trip: what the catalogue drops, the sidecar must
// carry. Without this, `expected()` dropping `description` would let the packer
// lose descriptions entirely and still pass.
test("every master description survives in the descriptions sidecar", () => {
  const side = descriptions.d || {};
  const missing = master
    .filter((s) => s.description && side[s.slug] !== s.description)
    .map((s) => s.id);
  assert.deepEqual(missing, [],
    `descriptions.min.json must carry each master description verbatim; missing/stale: ${missing.slice(0, 5)}`);
});

test("imageUrl re-attaches the host, upgrades http, passes https through", () => {
  assert.equal(imageUrl("abc-guid"), "https://registration.edfringe.com/resource/image/abc-guid");
  assert.equal(imageUrl("http://other.example/x.jpg"), "https://other.example/x.jpg");
  assert.equal(imageUrl("https://other.example/x.jpg"), "https://other.example/x.jpg");
  assert.equal(imageUrl(null), null);
  assert.equal(imageUrl(""), null);
});

test("mmddToDate expands an MMDD int into a festival-year ISO date", () => {
  assert.equal(mmddToDate(807, 2026), "2026-08-07");
  assert.equal(mmddToDate(724, 2026), "2026-07-24"); // a non-August date still round-trips
  assert.equal(mmddToDate(1231, 2026), "2026-12-31");
});

test("venueName is rebuilt from venue + room, or taken verbatim from vn", () => {
  const lk = {
    venues: { "39": { name: "theSpace on the Mile" } },
    rooms: ["Space 2"], genres: ["Theatre"], subgenres: [], ticketStatuses: [], ageRestrictions: [],
  };
  // No `vn` on the wire → rebuilt as "<room> at <venue name>".
  const [rebuilt] = rehydrateShows([{ i: "x", rm: 0, g: 0, v: "39", p: [] }], lk, YEAR);
  assert.equal(rebuilt.venueName, "Space 2 at theSpace on the Mile");
  assert.equal(rebuilt.room, "Space 2");
  // A show with no resolvable venue keeps its stored `vn` (present, even if null).
  const [stored] = rehydrateShows([{ i: "y", rm: -1, g: 0, v: null, vn: "Somewhere Odd", p: [] }], lk, YEAR);
  assert.equal(stored.venueName, "Somewhere Odd");
  assert.equal(stored.venue, null);
});

test("smallImage mirrors image when the wire omits si, and differs when si is present", () => {
  const lk = { rooms: [], genres: ["Theatre"], subgenres: [], ticketStatuses: [], ageRestrictions: [], venues: {} };
  const [mirrored] = rehydrateShows([{ i: "a", g: 0, rm: -1, v: null, vn: null, im: "g1", p: [] }], lk, YEAR);
  assert.equal(mirrored.image, imageUrl("g1"));
  assert.equal(mirrored.smallImage, imageUrl("g1")); // dropped si → mirrors image
  const [distinct] = rehydrateShows([{ i: "b", g: 0, rm: -1, v: null, vn: null, im: "g1", si: "g2", p: [] }], lk, YEAR);
  assert.equal(distinct.smallImage, imageUrl("g2")); // present si → its own value
});

test("flags become booleans and enum indices resolve through the lookups", () => {
  const lk = {
    venues: {}, rooms: ["Room A"], genres: ["Comedy", "Theatre"],
    subgenres: ["Improv", "Sketch"], ticketStatuses: ["AVAILABLE", "SOLD_OUT"], ageRestrictions: ["ZERO", "EIGHTEEN"],
  };
  const avail = {
    v: 1, ts: ["AVAILABLE", "SOLD_OUT"],
    a: { z: { "810|20:00": 1 } }, o: { z: ["810|20:00"] },
  };
  const [show] = rehydrateShows([{
    i: "z", t: "T", sl: "t", g: 1, sg: [1, 0], ar: 1, f: 1, im: "g", rm: 0, v: null, vn: null,
    p: [{ d: 810, s: "20:00" }],
  }], lk, YEAR, avail);
  assert.equal(show.genre, "Theatre");
  assert.deepEqual(show.subgenres, ["Sketch", "Improv"]);
  assert.equal(show.ageRestriction, "EIGHTEEN");
  assert.equal(show.free, true);
  assert.deepEqual(show.performances[0], {
    date: "2026-08-10", start: "20:00", soldOut: true, status: "SOLD_OUT",
  });
});

// --- The availability join ------------------------------------------------
//
// The catalogue and the sidecar are cached on different clocks (four days vs.
// one), so the client routinely joins a stale catalogue to fresh availability.
// These pin down what that join does when the two disagree — the failure mode
// worth caring about is a performance silently inheriting a status that isn't
// its own.

test("a performance is named by date + start, duplicates suffixed by position", () => {
  assert.deepEqual(performanceKeys([{ d: 807, s: "21:15" }]), ["807|21:15"]);
  // A few shows in the real data sit the same date and start twice with
  // different statuses; they must not collapse into one entry.
  assert.deepEqual(
    performanceKeys([{ d: 807, s: "13:20" }, { d: 807, s: "13:20" }, { d: 808, s: "13:20" }]),
    ["807|13:20", "807|13:20#1", "808|13:20"]);
  assert.deepEqual(performanceKeys(undefined), []);
});

test("availability missing entirely leaves every performance status-unknown", () => {
  const lk = { venues: {}, rooms: [], genres: ["Comedy"], subgenres: [], ageRestrictions: [] };
  const wireRec = [{ i: "z", g: 0, rm: -1, v: null, vn: null, p: [{ d: 810, s: "20:00" }] }];
  for (const missing of [null, undefined, {}]) {
    const [show] = rehydrateShows(wireRec, lk, YEAR, missing);
    assert.deepEqual(show.performances[0], {
      date: "2026-08-10", start: "20:00", soldOut: false, status: null,
    }, "an absent sidecar must read as unknown, never as available");
  }
});

test("a performance the sidecar doesn't name reads as unknown, not as its neighbour's", () => {
  // The catalogue is four days old and still lists a date the show has since
  // dropped; the sidecar knows only the surviving one.
  const avail = { v: 1, ts: ["TICKETS_AVAILABLE"], a: { z: { "811|20:00": 0 } }, o: {} };
  assert.deepEqual(performanceAvailability(avail, "z", "810|20:00"),
    { status: null, soldOut: false });
  assert.deepEqual(performanceAvailability(avail, "z", "811|20:00"),
    { status: "TICKETS_AVAILABLE", soldOut: false });
  // A show the sidecar has never heard of behaves the same way.
  assert.deepEqual(performanceAvailability(avail, "nosuchshow", "811|20:00"),
    { status: null, soldOut: false });
});

test("soldOut comes from the sparse `o` map, per performance", () => {
  const avail = {
    v: 1, ts: ["TICKETS_AVAILABLE"],
    a: { z: { "810|20:00": 0, "811|20:00": 0 } },
    o: { z: ["811|20:00"] },
  };
  assert.equal(performanceAvailability(avail, "z", "810|20:00").soldOut, false);
  assert.equal(performanceAvailability(avail, "z", "811|20:00").soldOut, true);
});

test("the shipped catalogue carries no availability of its own", () => {
  // The whole four-day cache rests on this: if a ticket status ever leaks back
  // into shows.min.json, that bulky file starts churning with every ticket
  // refresh and a cached copy starts freezing availability.
  for (const rec of wire) {
    for (const p of rec.p || []) {
      assert.deepEqual(Object.keys(p).sort(), ["d", "s"],
        `performance of ${rec.i} must carry only its date and start, got ${JSON.stringify(p)}`);
    }
  }
});

test("the JS join fingerprint agrees with the Python one that stamped the sidecar", () => {
  // The one test holding two implementations in two languages together: this
  // recomputes, from the committed catalogue, the value scraper/normalize.py's
  // join_fingerprint() wrote into the committed sidecar. They are only useful
  // while they agree, and nothing else would notice them drifting apart — the
  // client would simply start refetching on every load, which looks like a
  // network problem rather than a hashing one.
  assert.equal(typeof availability.k, "string",
    "the sidecar must carry the fingerprint of the catalogue it was built for");
  assert.equal(joinFingerprint(wire), availability.k);
});

test("the fingerprint moves when a start time is corrected", () => {
  // The failure it exists for. #274 shifted every performance by an hour and the
  // sidecar's date|start keys moved with it, so the previous day's catalogue
  // joined to almost nothing — silently, because a missed key is indistinguishable
  // from a performance with no status yet (#309).
  const shifted = wire.slice(0, 50).map((r) => ({
    ...r, p: (r.p || []).map((p) => ({ ...p, s: "0" + p.s.slice(1) })),
  }));
  assert.notEqual(joinFingerprint(shifted), joinFingerprint(wire.slice(0, 50)));
});

test("the fingerprint is stable across rehydration, and blind to what isn't joined", () => {
  // It must pin the *join surface* and nothing else, or every price refresh would
  // invalidate a catalogue that still joins perfectly.
  const repriced = wire.slice(0, 50).map((r) => ({ ...r, pm: (r.pm ?? 0) + 1, b: "different blurb" }));
  assert.equal(joinFingerprint(repriced), joinFingerprint(wire.slice(0, 50)));
});
