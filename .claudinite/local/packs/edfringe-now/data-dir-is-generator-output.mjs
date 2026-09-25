// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// The repo holds two data trees and normalize.py writes both: `site/data/`, the
// wire files the browser fetches, and `data/`, the pipeline's own working files.
// Its module header is the authoritative list:
//
//   site/data/normalized/shows.min.json, availability.min.json, descriptions.min.json
//   site/data/venues.json
//   site/data/days/<YYYY-MM-DD>.json + site/data/days/index.json
//   data/normalized/shows.json                   the master, which no page fetches
//
// Both trees are scanned, because the hazard is the same on either side of the
// publish boundary — worse on the published one, where an unowned file is served
// to visitors. So a file under either that isn't one of those shapes came from a hand, a
// throwaway probe, or a force-added raw cache — and the next `refresh-shows`
// run neither maintains it nor knows about it. The patterns are deliberately
// shape-based (a dir plus a `.json` leaf) rather than a literal file list, so a
// new day file or a new normalized artefact doesn't trip the check; a whole new
// output *directory* does, which is the moment a human should confirm the
// producer really writes it.
const ALLOWED_PATTERNS = [
  /^site\/data\/normalized\/[^/]+\.json$/,
  /^site\/data\/days\/[^/]+\.json$/,
  /^data\/normalized\/[^/]+\.json$/,
];

// The two roots a committed data file may sit under. Named once so the scan, the
// findings and this file's own prose cannot drift apart.
const DATA_ROOTS = ['site/data/', 'data/'];

// Grandfathered: the pre-pipeline mock dataset the design-concepts prototypes
// still load, documented as such in README.md. It is not normalizer output and
// never will be; it is exempt by name so the rule can stay strict for everything
// else. Do not add to this list — new data comes from the normalizer.
const ALLOWED_FILES = new Set(['site/data/venues.json', 'data/shows.json']);

// The one committed file under data/ that is an *input* to normalize.py rather
// than an output of it: the fetch-once ticket-price cache written by
// scraper/fetch_prices.py. It satisfies what this rule is actually protecting —
// a script in this repo produces it, and nothing silently destroys it (the
// normalizer only ever reads it) — so it is named here rather than exempted by
// shape. Anything else claiming to be a second input needs the same scrutiny
// this entry got, which is why it is one name and not a pattern.
const ALLOWED_INPUTS = new Map([
  ['data/prices.json', 'scraper/fetch_prices.py'],
  // The small festivals' raw: each file a hand-run fetcher writes under its own
  // data/festivals/<festival>/<edition>/<source>/, and the converter only reads.
  ['data/festivals/jerusalem-comedy/2026/comedy-festival-site/manifest.json', 'scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py'],
  ['data/festivals/jerusalem-comedy/2026/comedy-festival-site/programme.json', 'scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py'],
  ['data/festivals/jerusalem-comedy/2026/nominatim/manifest.json', 'scraper/festivals/jerusalem/sources/nominatim/fetch.py'],
  ['data/festivals/jerusalem-comedy/2026/nominatim/geocode.json', 'scraper/festivals/jerusalem/sources/nominatim/fetch.py'],
  ['data/festivals/acco/2026/acco-tc/manifest.json', 'scraper/festivals/acco/sources/acco-tc/fetch.py'],
  ['data/festivals/acco/2026/acco-tc/programme.json', 'scraper/festivals/acco/sources/acco-tc/fetch.py'],
  ['data/festivals/acco/2026/eventer/manifest.json', 'scraper/festivals/acco/sources/eventer/fetch.py'],
  ['data/festivals/acco/2026/eventer/programme.json', 'scraper/festivals/acco/sources/eventer/fetch.py'],
  ['data/festivals/acco/2026/street-programme/manifest.json', 'scraper/festivals/acco/sources/street-programme/fetch.py'],
  ['data/festivals/acco/2026/street-programme/programme.json', 'scraper/festivals/acco/sources/street-programme/fetch.py'],
  ['data/festivals/haifa-iff/2026/haifaff-site/manifest.json', 'scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py'],
  ['data/festivals/haifa-iff/2026/haifaff-site/programme.json', 'scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py'],
  ['data/festivals/brighton-fringe/2026/eventotron/manifest.json', 'scraper/festivals/brighton_fringe/sources/eventotron/fetch.py'],
  ['data/festivals/brighton-fringe/2026/eventotron/programme.json', 'scraper/festivals/brighton_fringe/sources/eventotron/fetch.py'],
  ['data/festivals/edinburgh-art-festival/2026/festival-site/manifest.json', 'scraper/festivals/edinburgh_art_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-art-festival/2026/festival-site/programme.json', 'scraper/festivals/edinburgh_art_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/nominatim/geocode.json', 'scraper/festivals/edinburgh_book_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/nominatim/manifest.json', 'scraper/festivals/edinburgh_book_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/spektrix/manifest.json', 'scraper/festivals/edinburgh_book_festival/sources/spektrix/fetch.py'],
  ['data/festivals/edinburgh-book-festival/2026/spektrix/programme.json', 'scraper/festivals/edinburgh_book_festival/sources/spektrix/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/festival-site/manifest.json', 'scraper/festivals/edinburgh_deaf_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/festival-site/programme.json', 'scraper/festivals/edinburgh_deaf_festival/sources/festival-site/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/nominatim/geocode.json', 'scraper/festivals/edinburgh_deaf_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-deaf-festival/2026/nominatim/manifest.json', 'scraper/festivals/edinburgh_deaf_festival/sources/nominatim/fetch.py'],
  ['data/festivals/edinburgh-tattoo/2027/ticketing-api/manifest.json', 'scraper/festivals/edinburgh_tattoo/sources/ticketing-api/fetch.py'],
  ['data/festivals/edinburgh-tattoo/2027/ticketing-api/programme.json', 'scraper/festivals/edinburgh_tattoo/sources/ticketing-api/fetch.py'],
  ['data/festivals/eif/2026/nominatim/geocode.json', 'scraper/festivals/eif/sources/nominatim/fetch.py'],
  ['data/festivals/eif/2026/nominatim/manifest.json', 'scraper/festivals/eif/sources/nominatim/fetch.py'],
  ['data/festivals/eif/2026/spektrix/manifest.json', 'scraper/festivals/eif/sources/spektrix/fetch.py'],
  ['data/festivals/eif/2026/spektrix/programme.json', 'scraper/festivals/eif/sources/spektrix/fetch.py'],
  ['data/festivals/eiff/2026/festival-site/manifest.json', 'scraper/festivals/eiff/sources/festival-site/fetch.py'],
  ['data/festivals/eiff/2026/festival-site/programme.json', 'scraper/festivals/eiff/sources/festival-site/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/festival-site/manifest.json', 'scraper/festivals/fringe_by_the_sea/sources/festival-site/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/festival-site/programme.json', 'scraper/festivals/fringe_by_the_sea/sources/festival-site/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/nominatim/geocode.json', 'scraper/festivals/fringe_by_the_sea/sources/nominatim/fetch.py'],
  ['data/festivals/fringe-by-the-sea/2026/nominatim/manifest.json', 'scraper/festivals/fringe_by_the_sea/sources/nominatim/fetch.py'],
  ['data/festivals/leicester-comedy/2026/eventotron/manifest.json', 'scraper/festivals/leicester_comedy/sources/eventotron/fetch.py'],
  ['data/festivals/leicester-comedy/2026/eventotron/programme.json', 'scraper/festivals/leicester_comedy/sources/eventotron/fetch.py'],
  // The cities' sightseeing raw, written by scraper/cities/fetch.py per city and source.
  ['data/cities/auckland/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/auckland/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/brighton/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/edinburgh/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/leicester/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/melbourne/wikidata/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/osm/manifest.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/osm/places.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/wikidata/entities.json', 'scraper/cities/fetch.py'],
  ['data/cities/wellington/wikidata/manifest.json', 'scraper/cities/fetch.py'],
]);

// Committed files under the data trees written by a generator in this repo that
// is NOT normalize.py: the festival and city converters' serving files and registries.
//
// Named, not shaped: a new festival's or edition's file is exactly the moment a
// human should confirm the producer really writes what is in it, so a file that
// merely sits beside an allowed one still trips the rule.
const ALLOWED_OUTPUTS = new Map([
  ['site/data/festivals/index.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/jerusalem-comedy/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/acco/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/haifa-iff/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/brighton-fringe/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-art-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-book-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-deaf-festival/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/edinburgh-tattoo/2027.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/eif/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/eiff/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/fringe-by-the-sea/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/festivals/leicester-comedy/2026.json', 'scraper/convert/to_serving.py'],
  ['site/data/cities/auckland.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/brighton.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/edinburgh.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/index.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/leicester.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/melbourne.json', 'scraper/cities/to_serving.py'],
  ['site/data/cities/wellington.json', 'scraper/cities/to_serving.py'],
]);

// The bulky raw scrape caches are git-ignored (`.gitignore`) precisely because
// each is regenerable by the scraper that fills it. One reaches the tree only
// via a deliberate `git add -f`, so it gets its own finding: the fix is to
// un-stage it, not to delete data the site needs.
const RAW_CACHES = new Map([
  ['data/raw_pages/', 'scraper/fetch_shows.py'],
  ['data/festivals/.cache/', 'the festival fetchers under scraper/festivals/'],
]);

const rule = {
  id: 'edfringe-data-dir-is-generator-output',
  severity: 'blocking',
  description: "Every committed file under site/data/ or data/ is one of scraper/normalize.py's outputs — no hand-made files, no probe dumps, no raw cache",
  why:
    'both data trees are generator output — site/data/ is fetched by the browser and the next refresh-shows run rewrites them wholesale, so a file that the normalizer does not produce is either silently served to users or silently destroyed — and either way the thing that produced it is not in the repo',
  doc: 'RULES.md',

  run(ctx) {
    const out = [];
    for (const f of ctx.files.filter((p) => DATA_ROOTS.some((r) => p.startsWith(r))).sort()) {
      const cache = [...RAW_CACHES].find(([prefix]) => f.startsWith(prefix));
      if (cache) {
        out.push(finding(f,
          `${f} is a git-ignored raw scrape cache — un-track it (\`git rm --cached ${f}\`); ${cache[1]} regenerates it, so it is never committed`,
        ));
        continue;
      }
      if (ALLOWED_FILES.has(f) || ALLOWED_INPUTS.has(f) || ALLOWED_OUTPUTS.has(f)) continue;
      if (ALLOWED_PATTERNS.some((re) => re.test(f))) continue;
      out.push(finding(f,
        `delete ${f} — everything under site/data/ and data/ is scraper/normalize.py's output (site/data/venues.json, site/data/normalized/*.json, site/data/days/*.json, data/normalized/shows.json), plus the named scraper inputs (${[...ALLOWED_INPUTS.keys()].join(', ')}) and the named outputs of this repo's other generators (${[...ALLOWED_OUTPUTS.keys()].join(', ')}). A probe informs the normalizer, it does not feed it: fix scraper/normalize.py and re-run it instead. If normalize.py genuinely writes ${f} now, add its shape to this check's allowlist in the same commit; if another scraper in this repo produces it, add it to ALLOWED_INPUTS or ALLOWED_OUTPUTS naming that script`,
      ));
    }
    return out;
  },
};

function finding(file, fix) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line: null,
    what: `${file} is under a data tree but is not something a generator in this repo produces`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
