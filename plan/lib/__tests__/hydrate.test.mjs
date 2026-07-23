// Tests for the compact-catalogue rehydration (plan/lib/hydrate.js), the client
// half of the shows.min.json minification. The headline test round-trips the
// REAL committed artifacts: it packs nothing itself but asserts that the
// shipped shows.min.json, unpacked against the shipped venues.json, reproduces
// the master shows.json exactly — so any drift between scraper/normalize.py's
// packer and this unpacker (or a stale shows.min.json) fails the build.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { imageUrl, mmddToDate, rehydrateShows } from "../hydrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "..", "..", "data");
const master = JSON.parse(readFileSync(path.join(DATA, "normalized", "shows.json"), "utf-8"));
const wire = JSON.parse(readFileSync(path.join(DATA, "normalized", "shows.min.json"), "utf-8"));
const lookups = JSON.parse(readFileSync(path.join(DATA, "venues.json"), "utf-8"));

const YEAR = 2026;

// The intended client record is the master with image/smallImage resolved to
// absolute https urls — the client always renders imageUrl(image), so that
// transform is intended, not loss.
function expected(show) {
  return { ...show, image: imageUrl(show.image), smallImage: imageUrl(show.smallImage) };
}

test("shows.min.json rehydrates byte-identical to the master shows.json", () => {
  const rehydrated = rehydrateShows(wire, lookups, YEAR);
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
  const [show] = rehydrateShows([{
    i: "z", t: "T", sl: "t", g: 1, sg: [1, 0], ar: 1, f: 1, im: "g", rm: 0, v: null, vn: null,
    p: [{ d: 810, s: "20:00", o: 1, t: 1 }],
  }], lk, YEAR);
  assert.equal(show.genre, "Theatre");
  assert.deepEqual(show.subgenres, ["Sketch", "Improv"]);
  assert.equal(show.ageRestriction, "EIGHTEEN");
  assert.equal(show.free, true);
  assert.deepEqual(show.performances[0], {
    date: "2026-08-10", start: "20:00", soldOut: true, status: "SOLD_OUT",
  });
});
