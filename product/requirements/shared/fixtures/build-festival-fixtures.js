// Freezer for the festival planner's fixtures. Run from the repo root:
// `node product/requirements/shared/fixtures/build-festival-fixtures.js`.
//
// It copies the festival registry (site/data/festivals/index.json) and every
// edition block the registry points at into fixtures/data/festivals/, from the
// repo's real committed data. The outputs are committed and FROZEN: a
// re-conversion of a festival's data moves no golden until this is re-run,
// and re-running it re-casts every Part V golden — a deliberate re-baselining.
//
// Documented deviations from the source bytes (each marked ADJUST below):
//   1. registry: a festival whose data has not landed yet is added by its
//      identity alone (dates, city, no programme), so the year's timeline has
//      the festivals the planner is being built for — see FESTIVALS_AWAITED.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const OUT = path.join(__dirname, "data");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const write = (rel, value) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value));
  console.log(`wrote ${rel}`);
};

// The registry and every edition block it points at, copied verbatim, no cast:
// the small festivals are smaller than any selection worth making, and the
// spec's Part V asserts the real programme rather than a sample of it. The
// copy is still made HERE rather than read live, because the freeze is what
// stops a re-scrape moving a golden.
const registry = read("site/data/festivals/index.json");
for (const festival of registry.festivals) {
  for (const edition of festival.editions) {
    if (edition.dataUrl) write(edition.dataUrl.replace(/^\/data\//, ""), read(`site${edition.dataUrl}`));
  }
}

// ADJUST (1): festivals whose data is on its way but not yet in the registry.
// Identity only — each entry as its own data branch registers it — and no
// `dataUrl`, which is the registry's own way of saying "no programme yet", so
// nothing here invents a performance. An entry is added only while the real
// registry lacks that festival; once its data lands, the real entry is copied
// above and this one is skipped.
const FESTIVALS_AWAITED = [
  {
    // haifaff.co.il: "Haifa 42nd International Film Festival", 25 Sep – 3 Oct 2026.
    id: "haifa-iff",
    name: "Haifa International Film Festival",
    nameLocal: "פסטיבל הסרטים הבינלאומי חיפה",
    city: "Haifa",
    country: "IL",
    lat: 32.794044,
    lng: 34.989571,
    timezone: "Asia/Jerusalem",
    lang: "en",
    dir: "ltr",
    kind: "film",
    defaultGenre: "film",
    site: "https://www.haifaff.co.il",
    editions: [{ id: "2026", ordinal: 42, firstDate: "2026-09-25", lastDate: "2026-10-03", dataUrl: null }],
  },
  {
    // accofestival.co.il: the festival runs 27 Sep – 1 Oct 2026 in
    // the old city, its street programme 28–30 Sep.
    id: "acco",
    name: "Acco Festival of Alternative Israeli Theatre",
    nameLocal: "פסטיבל עכו הבינלאומי לתיאטרון אחר",
    city: "Akko",
    country: "IL",
    lat: 32.9236,
    lng: 35.0705,
    timezone: "Asia/Jerusalem",
    lang: "he",
    dir: "rtl",
    kind: "theatre",
    defaultGenre: "theatre",
    site: "https://accofestival.co.il",
    editions: [{ id: "2026", ordinal: null, firstDate: "2026-09-27", lastDate: "2026-10-01", dataUrl: null }],
  },
];
const known = new Set(registry.festivals.map((f) => f.id));
write("festivals/index.json", {
  ...registry,
  festivals: [...registry.festivals, ...FESTIVALS_AWAITED.filter((f) => !known.has(f.id))],
});

