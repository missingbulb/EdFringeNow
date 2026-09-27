import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { TICKETING_MODELS } from "../checkout.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

// The ways a festival may sell its tickets are declared twice: the registry
// refuses a festival.toml naming any other (scraper/festivals/registry.py's
// TICKETING_MODELS), and checkout.js says what each one opens. Python cannot
// import the JavaScript table, so the two lists are compared here.
test("the checkout knows every ticketing model the registry accepts, and no other", () => {
  const source = readFileSync(path.join(ROOT, "scraper", "festivals", "registry.py"), "utf8");
  const tuple = source.match(/^TICKETING_MODELS = \(([^)]*)\)/m);
  assert.ok(tuple, "registry.py declares TICKETING_MODELS on one line");
  const declared = [...tuple[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(TICKETING_MODELS), declared);
});

test("every festival in the registry says how its tickets are sold", () => {
  const index = JSON.parse(readFileSync(path.join(ROOT, "site", "data", "festivals", "index.json"), "utf8"));
  for (const festival of index.festivals) {
    assert.ok(TICKETING_MODELS[festival.ticketing?.model], `${festival.id} names a known ticketing model`);
  }
});
