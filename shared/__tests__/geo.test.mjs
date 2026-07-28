// Node test for the geography helpers both front-ends import. No dependencies —
// plain node:test + node:assert. Run from the repo root with:
//   node --test shared/__tests__/geo.test.mjs
//
// These values used to be copy-pasted into js/app.js and plan/plan.js with
// nothing tying the copies together. Now there is one definition, and this is
// the test that pins its behaviour for both callers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { UK_BOUNDS, isInUK } from "../geo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

test("the box covers the UK mainland, including Edinburgh", () => {
  assert.ok(isInUK([55.9486, -3.1881]), "Edinburgh (the whole point) must be inside");
  assert.ok(isInUK([51.5072, -0.1276]), "London");
  assert.ok(isInUK([57.4778, -4.2247]), "Inverness");
  assert.ok(isInUK([50.0657, -5.7132]), "Land's End");
});

test("locations outside the UK are excluded", () => {
  assert.ok(!isInUK([40.7128, -74.006]), "New York — the overseas-tester case");
  assert.ok(!isInUK([48.8566, 2.3522]), "Paris is east of maxLng");
  assert.ok(!isInUK([64.1466, -21.9426]), "Reykjavik is north of maxLat");
  assert.ok(!isInUK([-33.8688, 151.2093]), "Sydney");
});

test("the box is inclusive at its own edges", () => {
  const { minLat, maxLat, minLng, maxLng } = UK_BOUNDS;
  assert.ok(isInUK([minLat, minLng]), "south-west corner is inside");
  assert.ok(isInUK([maxLat, maxLng]), "north-east corner is inside");
  assert.ok(!isInUK([minLat - 0.001, minLng]), "just south is outside");
  assert.ok(!isInUK([maxLat, maxLng + 0.001]), "just east is outside");
});

// The regression this file exists to prevent: the constant was duplicated, one
// copy was edited, and the two pages silently disagreed. Both front-ends must
// import it rather than declare their own.
test("neither front-end declares its own copy of the bounds", () => {
  for (const file of ["js/app.js", "plan/plan.js"]) {
    const src = readFileSync(path.join(REPO, file), "utf8");
    assert.doesNotMatch(
      src,
      /(?:const|let|var)\s+UK_BOUNDS\s*=/,
      `${file} declares its own UK_BOUNDS — import it from shared/geo.js instead`
    );
    assert.match(src, /from\s+["']\.\.\/shared\/geo\.js["']/, `${file} must import from shared/geo.js`);
  }
});
