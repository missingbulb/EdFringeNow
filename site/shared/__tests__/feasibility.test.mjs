import { test } from "node:test";
import assert from "node:assert/strict";

import { poolReach, originReach, travelDays, inReach } from "../feasibility.js";

const JERUSALEM = { festivalId: "jerusalem-comedy", lat: 31.7683, lng: 35.2137, firstDate: "2026-10-18", lastDate: "2026-10-22" };
const HAIFA = { festivalId: "haifa-iff", lat: 32.794, lng: 34.9896, firstDate: "2026-09-25", lastDate: "2026-10-03" };
const ACCO = { festivalId: "acco", lat: 32.9206, lng: 35.0694, firstDate: "2026-09-27", lastDate: "2026-10-01" };
const EDINBURGH = { festivalId: "edfringe", lat: 55.9533, lng: -3.1883, firstDate: "2026-10-10", lastDate: "2026-10-30" };

test("a city a day-trip away joins whole; a far one only outside the focus run and its travel days", () => {
  const period = { from: "2026-10-01", to: "2026-10-31" };
  const [focus, edinburgh] = poolReach(JERUSALEM, [JERUSALEM, EDINBURGH], period);
  assert.equal(focus.verdict, "focus");
  assert.equal(edinburgh.verdict, "partly");
  assert.equal(edinburgh.travelDays, 1);
  assert.deepEqual(edinburgh.nights, [
    { from: "2026-10-10", to: "2026-10-16" },
    { from: "2026-10-24", to: "2026-10-30" },
  ]);
  assert.equal(inReach(edinburgh, "2026-10-20"), false);
  assert.equal(inReach(edinburgh, "2026-10-12"), true);

  const [, acco] = poolReach(HAIFA, [HAIFA, ACCO], { from: "2026-09-24", to: "2026-10-04" });
  assert.equal(acco.verdict, "day-trip");
  assert.deepEqual(acco.nights, [{ from: "2026-09-27", to: "2026-10-01" }]);
});

test("a far edition wholly inside the focus run is out", () => {
  const inside = { ...EDINBURGH, firstDate: "2026-10-19", lastDate: "2026-10-21" };
  const [, far] = poolReach(JERUSALEM, [JERUSALEM, inside], { from: "2026-10-17", to: "2026-10-23" });
  assert.equal(far.verdict, "out");
  assert.deepEqual(far.nights, []);
});

test("travel days by distance", () => {
  assert.equal(travelDays(50), 0);
  assert.equal(travelDays(3500), 1);
  assert.equal(travelDays(9000), 2);
  assert.equal(travelDays(null), null);
});

test("where the reader comes from decides local, domestic or abroad", () => {
  const fest = { country: "IL", lat: 32.794, lng: 34.9896 };
  assert.equal(originReach(null, fest), null);
  assert.equal(originReach({ kind: "city", country: "IL", lat: 32.8, lng: 34.99 }, fest), "local");
  assert.equal(originReach({ kind: "city", country: "IL", lat: 31.7683, lng: 35.2137 }, fest), "domestic");
  assert.equal(originReach({ kind: "country", country: "IL" }, fest), "domestic");
  assert.equal(originReach({ kind: "abroad", country: "FR" }, fest), "abroad");
  assert.equal(originReach({ kind: "position", lat: 55.9533, lng: -3.1883 }, fest), "abroad");
  assert.equal(originReach({ kind: "position", lat: 31.7683, lng: 35.2137 }, fest), "domestic");
});
