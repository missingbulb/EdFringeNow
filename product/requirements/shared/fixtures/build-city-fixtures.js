// Freezer for the festival planner's city lists. Run from the repo root:
// `node product/requirements/shared/fixtures/build-city-fixtures.js`.
//
// It copies the cities' registry (site/data/cities/index.json) and the serving
// file of every city hosting a festival in the frozen festival registry into
// fixtures/data/cities/, verbatim. Its own freezer rather than a step of
// build-festival-fixtures.js, so that freezing the cities re-casts only the
// goldens that show a city's lists, never the festivals' programmes.
//
// Documented deviations from the source bytes (each marked ADJUST below):
//   1. registry: the cities no fixture festival is held in are left out, so a
//      city's data is either frozen here or absent, never a dangling dataUrl.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const OUT = path.join(__dirname, "data");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (rel, value) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value));
  console.log(`wrote ${rel}`);
};

const festivals = read(path.join(OUT, "festivals", "index.json")).festivals;
const hosts = new Set(festivals.map((f) => f.city));
const registry = read(path.join(ROOT, "site", "data", "cities", "index.json"));

// ADJUST (1): only the cities a fixture festival is held in.
const cities = registry.cities.filter((c) => hosts.has(c.name) && c.dataUrl);
write("cities/index.json", { ...registry, cities });
for (const city of cities) {
  write(city.dataUrl.replace(/^\/data\//, ""), read(path.join(ROOT, "site", city.dataUrl)));
}
