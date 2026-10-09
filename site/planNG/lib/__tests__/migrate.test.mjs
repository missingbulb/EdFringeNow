import { test } from "node:test";
import assert from "node:assert/strict";

import { migrateLegacy } from "../migrate.js";

const storeOf = (entries) => {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};
const OPTS = {
  from: "jerusalemPlan.",
  to: "planNG.",
  festivalId: "jerusalem-comedy",
  editionKey: "jerusalem-comedy@2026",
  nights: ["2026-10-18", "2026-10-19", "2026-10-20"],
};

test("legacy keys are translated, namespaced and removed", () => {
  const store = storeOf({
    "jerusalemPlan.starred": JSON.stringify(["a", "b"]),
    "jerusalemPlan.verdicts": JSON.stringify({ locked: { a: "a@k" }, noTime: ["b@k2"], noShow: ["c"] }),
    "jerusalemPlan.prefs": JSON.stringify({ d0: 2, d1: 3, interests: ["stand-up"], perDay: 2 }),
    "jerusalemPlan.theme": "dark",
  });
  const moved = migrateLegacy(store, OPTS);
  assert.equal(moved.length, 4);
  assert.deepEqual(JSON.parse(store.getItem("planNG.starred")), ["jerusalem-comedy/a", "jerusalem-comedy/b"]);
  const verdicts = JSON.parse(store.getItem("planNG.verdicts"));
  assert.deepEqual(verdicts.locked, { "jerusalem-comedy/a": "a@k" });
  assert.deepEqual(verdicts.noShow, ["jerusalem-comedy/c"]);
  const prefs = JSON.parse(store.getItem("planNG.prefs"));
  assert.deepEqual(prefs.windows, { "jerusalem-comedy@2026": { from: "2026-10-19", to: "2026-10-20" } });
  assert.deepEqual(prefs.interests, ["jerusalem-comedy/stand-up"]);
  assert.equal(prefs.perDay, 2);
  assert.equal(store.getItem("planNG.theme"), "dark");
  assert.equal([...store.map.keys()].filter((k) => k.startsWith("jerusalemPlan.")).length, 0);
});

test("a key already under the new name is kept, and the legacy one still goes", () => {
  const store = storeOf({
    "jerusalemPlan.starred": JSON.stringify(["a"]),
    "planNG.starred": JSON.stringify(["haifa-iff/x"]),
  });
  migrateLegacy(store, OPTS);
  assert.deepEqual(JSON.parse(store.getItem("planNG.starred")), ["haifa-iff/x"]);
  assert.equal(store.getItem("jerusalemPlan.starred"), null);
});
