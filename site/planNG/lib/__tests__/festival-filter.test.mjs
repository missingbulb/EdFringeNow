import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TYPES, typeOfKind } from "../festival-filter.js";

// The registry's kinds are written in scraper/festivals/registry.py; the grid
// must give every one of them exactly one type, or a festival of that kind
// could never be picked out.
test("every kind the registry allows belongs to exactly one of the nine types", () => {
  const source = readFileSync(new URL("../../../../scraper/festivals/registry.py", import.meta.url), "utf8");
  const kinds = JSON.parse(/^KINDS = \(([^)]*)\)/m.exec(source)[1].replace(/^/, "[").replace(/$/, "]"));
  assert.equal(TYPES.length, 9);
  for (const kind of kinds) {
    assert.equal(TYPES.filter((t) => t.kinds.includes(kind)).length, 1, kind);
    assert.ok(typeOfKind(kind));
  }
  assert.deepEqual(TYPES.flatMap((t) => t.kinds).sort(), [...kinds].sort(), "no type holds a kind the registry lacks");
});

test("every country the registry lists belongs to an area", async () => {
  const { areaOf } = await import("../areas.js");
  const index = JSON.parse(readFileSync(new URL("../../../data/festivals/index.json", import.meta.url), "utf8"));
  for (const f of index.festivals) assert.ok(areaOf(f.country), `${f.id} (${f.country})`);
});

test("stepping out goes city, country, area, anywhere, passing over an area of one country", async () => {
  const { parentPlace } = await import("../festival-filter.js");
  const registry = {
    festivals: [
      { country: "IL", city: "Haifa" },
      { country: "AU", city: "Melbourne" },
      { country: "NZ", city: "Auckland" },
    ],
  };
  assert.equal(parentPlace(registry, "IL/Haifa"), "IL");
  assert.equal(parentPlace(registry, "IL"), "");
  assert.equal(parentPlace(registry, "AU"), "@oceania");
  assert.equal(parentPlace(registry, "@oceania"), "");
  assert.equal(parentPlace(registry, ""), "");
});
