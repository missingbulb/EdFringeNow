import { test } from "node:test";
import assert from "node:assert/strict";

import { leadEdition, normalizeTrip, tripForEdition, tripFromQuery } from "../trip.js";

const registry = {
  festivals: [
    { id: "big", editions: [{ id: "2026", firstDate: "2026-09-25", lastDate: "2026-10-03" }] },
    { id: "small", editions: [{ id: "2026", firstDate: "2026-09-27", lastDate: "2026-10-01" }] },
    { id: "later", editions: [{ id: "2026", firstDate: "2026-10-18", lastDate: "2026-10-22" }] },
  ],
};

test("a festival's trip is its run and a day either side", () => {
  assert.deepEqual(tripForEdition({ firstDate: "2026-10-18", lastDate: "2026-10-22" }), { from: "2026-10-17", to: "2026-10-23" });
});

test("a trip's ends are put in order", () => {
  assert.deepEqual(normalizeTrip({ from: "2026-10-05", to: "2026-10-01" }, { maxDays: 31 }), { from: "2026-10-01", to: "2026-10-05" });
});

test("a trip past the cap pulls the end that was not moved", () => {
  assert.deepEqual(normalizeTrip({ from: "2026-10-01", to: "2026-11-15" }, { moved: "to", maxDays: 31 }), { from: "2026-10-16", to: "2026-11-15" });
  assert.deepEqual(normalizeTrip({ from: "2026-10-01", to: "2026-11-15" }, { moved: "from", maxDays: 31 }), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(normalizeTrip({ from: "2026-10-01", to: "2026-11-15" }, { maxDays: 31 }), { from: "2026-10-01", to: "2026-10-31" });
  // Exactly the cap is left alone.
  assert.deepEqual(normalizeTrip({ from: "2026-10-01", to: "2026-10-31" }, { moved: "to", maxDays: 31 }), { from: "2026-10-01", to: "2026-10-31" });
});

test("a trip is held inside the days the timeline shows", () => {
  const span = { from: "2026-08-01", to: "2027-07-31" };
  assert.deepEqual(normalizeTrip({ from: "2026-07-20", to: "2026-08-03" }, { maxDays: 31, span }), { from: "2026-08-01", to: "2026-08-03" });
  assert.deepEqual(normalizeTrip({ from: "2027-07-30", to: "2027-08-09" }, { maxDays: 31, span }), { from: "2027-07-30", to: "2027-07-31" });
});

test("the address names a trip only with two dates", () => {
  assert.deepEqual(tripFromQuery(new URLSearchParams("from=2026-10-01&to=2026-10-04")), { from: "2026-10-01", to: "2026-10-04" });
  assert.equal(tripFromQuery(new URLSearchParams("from=2026-10-01")), null);
  assert.equal(tripFromQuery(new URLSearchParams("from=soon&to=later")), null);
});

test("the edition a trip covers most leads it", () => {
  assert.equal(leadEdition(registry, { from: "2026-09-24", to: "2026-10-04" }).festival.id, "big");
  assert.equal(leadEdition(registry, { from: "2026-10-02", to: "2026-10-20" }).festival.id, "later");
});

test("a tie on days covered goes to the edition that starts first", () => {
  assert.equal(leadEdition(registry, { from: "2026-09-28", to: "2026-10-01" }).festival.id, "big");
});

test("a trip over no festival is led by the nearest one", () => {
  assert.equal(leadEdition(registry, { from: "2026-10-12", to: "2026-10-14" }).festival.id, "later");
  assert.equal(leadEdition(registry, { from: "2026-10-05", to: "2026-10-06" }).festival.id, "big");
  assert.equal(leadEdition({ festivals: [] }, { from: "2026-10-05", to: "2026-10-06" }), null);
});

test("the festival the reader chose leads while the trip reaches it", () => {
  // "small" is inside "big"'s run, so on days covered alone it would never lead.
  assert.equal(leadEdition(registry, { from: "2026-09-26", to: "2026-10-02", pick: "small@2026" }).festival.id, "small");
  assert.equal(leadEdition(registry, { from: "2026-09-30", to: "2026-10-01", pick: "small@2026" }).festival.id, "small", "down to its last shared day");
  assert.equal(leadEdition(registry, { from: "2026-10-02", to: "2026-10-20", pick: "small@2026" }).festival.id, "later", "and not once the trip has left it");
});
