#!/usr/bin/env node
//
// Writes the land the planner's globe draws: every country's outline from
// Natural Earth's 1:110m admin-0 countries (public domain), keyed by its
// ISO 3166-1 alpha-2 code, or its three-letter admin code where it has none.
//
//   node scripts/build-globe-land.mjs [geojson-path-or-url]
//
// Each ring is one flat list of longitude, latitude pairs in tenths of a
// degree, which is finer than the globe's few hundred pixels can show.

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "site", "planNG", "globe", "land.json");

async function load(from) {
  if (/^https?:/.test(from)) return (await fetch(from)).json();
  return JSON.parse(readFileSync(from, "utf8"));
}

function codeOf(props) {
  return props.ISO_A2_EH && props.ISO_A2_EH !== "-99" ? props.ISO_A2_EH : props.ADM0_A3;
}

function ringOf(coords) {
  const flat = [];
  for (const [lng, lat] of coords) {
    const x = Math.round(lng * 10);
    const y = Math.round(lat * 10);
    if (flat.length && flat[flat.length - 2] === x && flat[flat.length - 1] === y) continue;
    flat.push(x, y);
  }
  return flat;
}

const geo = await load(process.argv[2] || SOURCE);
const countries = {};
for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === "Polygon" ? [coordinates] : coordinates;
  // Holes are dropped: at this scale none is wider than a few pixels.
  const rings = polygons.map((polygon) => ringOf(polygon[0])).filter((ring) => ring.length >= 6);
  const code = codeOf(feature.properties);
  countries[code] = (countries[code] || []).concat(rings);
}
const sorted = Object.fromEntries(Object.keys(countries).sort().map((code) => [code, countries[code]]));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ source: "Natural Earth 1:110m admin-0 countries, public domain", countries: sorted }) + "\n"
);
console.log(`${Object.keys(sorted).length} countries`);
