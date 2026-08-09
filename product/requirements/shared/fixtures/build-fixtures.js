// One-time freezer for the requirements fixture dataset. Run from the repo
// root: `node product/requirements/shared/fixtures/build-fixtures.js`.
//
// It derives the fixtures from the repo's real committed data (real bytes,
// real schema — never hand-invented records), selecting a small, curated cast
// of shows that spans every UI state the spec asserts: available / sold-out /
// free / price-unknown / tight-timing on the Now page; every availability
// colour, a sold-out lane, a no-dates lane and a lunch-conflict lane on the
// planner. The outputs are committed and FROZEN — the live data refreshes
// nightly, the fixtures do not. Re-running this script against newer data
// changes the cast and therefore every golden; that is a deliberate,
// owner-approved re-baselining, never routine.
//
// Documented deviations from the source bytes (each marked ADJUST below):
//   1. planner: every performance of one favourite is forced sold-out, so the
//      "Sold out" lane verdict is renderable.
//   2. planner: one favourite is trimmed to a single available performance, so
//      pinning a clashing show renders the "Can't fit" verdict.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { encode } = require("../png");

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const OUT = path.join(__dirname, "data");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const write = (rel, value) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value));
  console.log(`wrote ${rel}`);
};

// ---------------------------------------------------------------- the cast --
// Now page (day file 2026-08-15, reference now 19:30): chosen for the states
// the §1–§8 leaves assert. Walk minutes are from the fixed fake location.
const NOW_SLUGS = [
  "ray-bradshaw-five-years-in-a-row", // 19:45, walk 6 — SOLD OUT stamp
  "david-alnwick-the-haunted-magician", // 19:40, walk 4 — Free
  "the-inverted-realm", // 20:55, walk 10 — no pm: Price TBC
  "likewise", // 19:35, walk 9 — arrival 19:39: TOO LATE (tight)
  "monks", // 19:35, walk 10 — hidden at default 10-min budget? kept: exactly 10
  "shinjuku", // 19:35, walk 10
  "front-for-something", // 20:00, walk 8 — free
  "the-mysterious-seelie-wight-women", // 20:30, walk 4 — sold out (2nd)
  "abandoman-afterglow", // 20:55, walk 10 — sold out (3rd)
  // Ten more nearby on-sale shows so the all-genres list overflows one page
  // (the "Show 12 more" leaf) and the committed list has plenty that fit.
  "a-good-time-charlie", // 19:40 Comedy
  "alice-keys-rocket-fan", // 19:40 Comedy
  "bride-to-be", // 19:40 Theatre
  "emotionally-undercooked", // 19:40 Theatre
  "spooky-dookie-cool-new-planet", // 19:40 Comedy
  "the-witches-of-macbeth", // 19:40 Theatre
  "this-is-how-i-got-arrested", // 19:40 Theatre
  "absolute-improv", // 19:45 Comedy
  "ghost-songs-to-die-for-with-madame-isolde", // 19:45 Cabaret and Variety
  "heated-rivalry-the-musical-parody", // 19:45 Musicals and Opera
];
// Constraint-picker targets: the default wheel time is 21:30 (19:30 + 2 h).
// Kept regardless of distance — the picker deliberately ignores every filter.
const CONSTRAINT_SLUGS = [];

// Planner favourites: the CSV upload + verdict variety across the 7–24 window.
const PLAN_FAVOURITE_SLUGS = [];

// ---------------------------------------------------------------- load real --
const venues = read("data/venues.json");
const day15 = Object.values(read("data/days/2026-08-15.json"));
const day14 = Object.values(read("data/days/2026-08-14.json"));
const catalogue = read("data/normalized/shows.min.json");
const availability = read("data/normalized/availability.min.json");

const TS = venues.ticketStatuses;
const tsIndex = (name) => {
  const i = TS.indexOf(name);
  if (i < 0) throw new Error(`status ${name} not in venues.json`);
  return i;
};

// Constraint picker: two real 21:30 starters (any venue).
for (const e of day15) {
  if (e.start === "21:30" && CONSTRAINT_SLUGS.length < 2) CONSTRAINT_SLUGS.push(e.slug);
}
if (CONSTRAINT_SLUGS.length < 2) throw new Error("no 21:30 starters on 2026-08-15");

// A show far beyond the default 10-minute walk budget (about 25–40 min out),
// for the "beyond the travel budget never appears" proof.
const U = { lat: 55.9523946827963, lng: -3.188258484671504 };
const distKm = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const dl = r(b.lat - a.lat);
  const dg = r(b.lng - a.lng);
  const s = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
};
const walkMin = (e) => {
  const ven = venues.venues[e.venue];
  if (!ven || ven.lat == null) return null;
  return (distKm(U, ven) / (10 / 3)) * 60;
};
const far = day15.find((e) => {
  const w = walkMin(e);
  return w !== null && w > 25 && w < 40 && e.start === "20:00" && !e.free;
});
if (!far) throw new Error("no far show found");
NOW_SLUGS.push(far.slug);
console.log(`far show: ${far.slug} (${Math.round(walkMin(far))} min walk)`);

// ------------------------------------------------------------- now fixtures --
const nowKeep = new Set([...NOW_SLUGS, ...CONSTRAINT_SLUGS]);
const day15Out = day15.filter((e) => nowKeep.has(e.slug));
const missing = [...nowKeep].filter((s) => !day15Out.some((e) => e.slug === s));
if (missing.length) throw new Error(`slugs missing from 2026-08-15: ${missing}`);
write("days/2026-08-15.json", day15Out);

// The pre-set-clock day (geolocation not confirmed in-UK): a handful of
// evening shows so the page has content on 2026-08-14 15:44 too.
const day14Out = day14.filter((e) => e.start >= "16:30" && e.start <= "18:00" && walkMin(e) !== null && walkMin(e) <= 9).slice(0, 5);
write("days/2026-08-14.json", day14Out);

// venues.json is kept WHOLE: the wire format indexes into its lists by
// position, so trimming it would relabel every show.
write("venues.json", venues);

// --------------------------------------------------------- planner fixtures --
// Favourites, chosen from the real catalogue for verdict variety:
const bySlug = new Map(catalogue.map((e) => [e.sl, e]));

// Helper: does a catalogue entry have performances in a day range? p[].d is a
// day serial; recover the serial for a calendar day from a known day-file
// match below. Instead we use the availability keys "serial|HH:MM".
const availOf = (entry) => availability.a[entry.si] || availability.a[entry.i] || null;

// Recover the serial for 7..31 Aug from any entry: entries carry p:[{d, s}],
// and the day files tell us which slug plays on 2026-08-15. Ray Bradshaw plays
// nightly; find its 19:45 perf serials via the availability map instead of
// guessing the epoch.
const ray = bySlug.get("ray-bradshaw-five-years-in-a-row");
if (!ray) throw new Error("ray not in catalogue");
const raySerials = ray.p.map((x) => x.d).sort((a, b) => a - b);
// data/days spans 1–31 Aug; ray's run is inside it. The 15th's serial:
const day15Serial = (() => {
  // ray appears in the 2026-08-15 day file at 19:45 — align serial by run
  // position: serial for Aug N = serialFor15 - 15 + N.
  // Find it by matching the count of run days ≤ each serial… simplest honest
  // anchor: the catalogue's earliest serial with the same count of days as the
  // distance from the run's first day-file appearance.
  // Ray's first day-file appearance:
  for (let d = 1; d <= 31; d++) {
    const df = read(`data/days/2026-08-${String(d).padStart(2, "0")}.json`);
    if (Object.values(df).some((e) => e.slug === ray.sl)) {
      return raySerials[0] + (15 - d);
    }
  }
  throw new Error("ray not found in any day file");
})();
const serialForAug = (n) => day15Serial - 15 + n;
console.log(`day serial for 15 Aug: ${day15Serial}`);

const hasPerfIn = (entry, fromAug, toAug) =>
  entry.p.some((x) => x.d >= serialForAug(fromAug) && x.d <= serialForAug(toAug));

// (a) three schedulable evening favourites at different venues, on sale
const scheduled = catalogue
  .filter(
    (e) =>
      e.p.length > 14 &&
      hasPerfIn(e, 8, 24) &&
      e.pm != null &&
      !e.f &&
      e.v &&
      venues.venues[e.v] &&
      venues.venues[e.v].lat != null &&
      e.p[0].s >= "19:00" &&
      e.p[0].s <= "21:00" &&
      availOf(e)
  )
  .slice(0, 3);
// (b) a lunchtime show whose whole run sits inside 12:30–13:30
const lunch = catalogue.find(
  (e) => e.p.length > 10 && e.p.every((x) => x.s >= "12:35" && x.s <= "13:00") && (e.d || 60) <= 60 && availOf(e)
);
// (c) a show playing only after the 24th (baddates in the default window)
const late = catalogue.find((e) => e.p.length >= 3 && e.p.every((x) => x.d > serialForAug(24)) && availOf(e));
// (d) sold-out lane: ADJUST — force every perf of one real favourite sold out
const soldLane = catalogue.find((e) => e.p.length > 14 && hasPerfIn(e, 8, 24) && e.sl !== ray.sl && e.p[0].s >= "18:00" && e.p[0].s < "19:00" && availOf(e));
// (e) can't-fit lane: ADJUST — trim to one perf, then pin a clash over it
const cantFit = catalogue.find(
  (e) =>
    e !== soldLane &&
    !scheduled.includes(e) &&
    e.p.length > 14 &&
    hasPerfIn(e, 8, 24) &&
    e.p.some((x) => x.d === day15Serial && x.s === scheduled[0].p[0].s) &&
    availOf(e)
);
// (f) a morning show for the "Too early" conflict (rendered with a seeded
// 13:00 day start), whole run before noon
const morning = catalogue.find((e) => e.p.length > 10 && e.p.every((x) => x.s >= "09:00" && x.s <= "11:00") && availOf(e));

for (const [label, e] of Object.entries({ lunch, late, soldLane, cantFit, morning })) {
  if (!e) throw new Error(`no candidate for ${label}`);
  console.log(`${label}: ${e.sl} (typical ${e.p[0].s})`);
}
PLAN_FAVOURITE_SLUGS.push(...scheduled.map((e) => e.sl), lunch.sl, late.sl, soldLane.sl, cantFit.sl, morning.sl, ray.sl);

// Catalogue subset: the favourites, the Now cast (shared world), plus a
// deterministic sample so search has something to chew on (~300 shows).
const keepCat = new Set([...PLAN_FAVOURITE_SLUGS, ...NOW_SLUGS, ...CONSTRAINT_SLUGS]);
for (const e of catalogue) {
  if (keepCat.size >= 300) break;
  keepCat.add(e.sl);
}
const catOut = catalogue.filter((e) => keepCat.has(e.sl));

// ADJUST (d): sold-out lane — every performance NO_ALLOCATION_CONTACT_VENUE.
// ADJUST (e): can't-fit lane — only the first Aug-15 performance stays on sale.
const availOut = { v: availability.v, ts: availability.ts, a: {}, o: availability.o };
const NOALLOC = tsIndex("NO_ALLOCATION_CONTACT_VENUE");
for (const e of catOut) {
  const key = availability.a[e.si] !== undefined ? e.si : e.i;
  const perfs = availability.a[key];
  if (!perfs) continue;
  let out = perfs;
  if (e === soldLane) {
    // Both halves of "sold out": the NO_ALLOCATION status (colours the marks
    // red) and the sold-keys list in `o` (what the lane verdict keys on).
    out = Object.fromEntries(Object.entries(perfs).map(([k]) => [k, NOALLOC]));
    availOut.o[key] = Object.keys(perfs);
  } else if (e === cantFit) {
    const keep = `${day15Serial}|${e.p.find((x) => x.d === day15Serial)?.s || e.p[0].s}`;
    out = Object.fromEntries(Object.entries(perfs).filter(([k]) => k === keep));
    if (!Object.keys(out).length) throw new Error("cantFit lost its kept perf");
  }
  availOut.a[key] = out;
}
write("normalized/shows.min.json", catOut);
write("normalized/availability.min.json", availOut);

// Descriptions sidecar: real shape ({v, d: slug→text}? mirror the committed
// file's structure with just our cast).
const desc = read("data/normalized/descriptions.min.json");
const descKey = Object.keys(desc).find((k) => k !== "v");
const descOut = { v: desc.v };
descOut[descKey] = {};
for (const s of keepCat) {
  if (desc[descKey][s]) descOut[descKey][s] = desc[descKey][s];
}
write("normalized/descriptions.min.json", descOut);

// ------------------------------------------------------------ small fixtures --
fs.writeFileSync(
  path.join(__dirname, "package.json.fixture"),
  JSON.stringify({ name: "edfringenow", version: "0.0.0-spec" }) + "\n"
);

// Favourites CSV in the edfringe.com export shape (one URL per row cell).
const csvRows = ["Title,URL"];
for (const s of PLAN_FAVOURITE_SLUGS) {
  const e = bySlug.get(s);
  csvRows.push(`"${e.t.replace(/"/g, '""')}",https://www.edfringe.com/tickets/whats-on/${s}`);
}
fs.writeFileSync(path.join(__dirname, "favourites.csv"), csvRows.join("\r\n") + "\r\n");
console.log(`favourites.csv: ${PLAN_FAVOURITE_SLUGS.length} shows`);

// A deterministic 256×256 map tile: pale ground with a faint street grid.
const W = 256;
const rgba = Buffer.alloc(W * W * 4);
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const grid = x % 64 === 0 || y % 64 === 0;
    const o = (y * W + x) * 4;
    rgba[o] = grid ? 214 : 232;
    rgba[o + 1] = grid ? 216 : 234;
    rgba[o + 2] = grid ? 222 : 238;
    rgba[o + 3] = 255;
  }
}
fs.writeFileSync(path.join(__dirname, "tile.png"), encode({ width: W, height: W, rgba }));

// Nominatim response for the place-search cases: two in-box hits (a
// restaurant and the station) and one out-of-box hit that must be dropped.
fs.writeFileSync(
  path.join(__dirname, "geocode.json"),
  JSON.stringify([
    {
      display_name: "The Witchery by the Castle, Castlehill, Edinburgh",
      name: "The Witchery by the Castle",
      lat: "55.9489",
      lon: "-3.1950",
      category: "amenity",
      type: "restaurant",
      address: { road: "Castlehill" },
    },
    {
      display_name: "Edinburgh Waverley, Princes Street, Edinburgh",
      name: "Edinburgh Waverley",
      lat: "55.9520",
      lon: "-3.1890",
      category: "railway",
      type: "station",
      address: { road: "Princes Street" },
    },
    {
      display_name: "Waverley Castle Hotel, Melrose",
      name: "Waverley Castle Hotel",
      lat: "55.6000",
      lon: "-2.7300",
      category: "tourism",
      type: "hotel",
      address: { road: "Skirmish Hill" },
    },
  ]) + "\n"
);

console.log("\nCast summary:");
console.log("  Now:", NOW_SLUGS.join(", "));
console.log("  Constraint:", CONSTRAINT_SLUGS.join(", "));
console.log("  Planner favourites:", PLAN_FAVOURITE_SLUGS.join(", "));
