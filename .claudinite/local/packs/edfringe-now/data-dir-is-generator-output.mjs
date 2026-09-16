// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// Everything the browser fetches out of `data/` is written by
// `scraper/normalize.py` — its module header is the authoritative list:
//
//   data/normalized/shows.json, shows.min.json, descriptions.min.json
//   data/venues.json
//   data/days/<YYYY-MM-DD>.json + data/days/index.json
//
// So a file under `data/` that isn't one of those shapes came from a hand, a
// throwaway probe, or a force-added raw cache — and the next `refresh-shows`
// run neither maintains it nor knows about it. The patterns are deliberately
// shape-based (a dir plus a `.json` leaf) rather than a literal file list, so a
// new day file or a new normalized artefact doesn't trip the check; a whole new
// output *directory* does, which is the moment a human should confirm the
// producer really writes it.
const ALLOWED_PATTERNS = [
  /^data\/normalized\/[^/]+\.json$/,
  /^data\/days\/[^/]+\.json$/,
];

// Grandfathered: the pre-pipeline mock dataset the design-concepts prototypes
// still load, documented as such in README.md. It is not normalizer output and
// never will be; it is exempt by name so the rule can stay strict for everything
// else. Do not add to this list — new data comes from the normalizer.
const ALLOWED_FILES = new Set(['data/venues.json', 'data/shows.json']);

// The one committed file under data/ that is an *input* to normalize.py rather
// than an output of it: the fetch-once ticket-price cache written by
// scraper/fetch_prices.py. It satisfies what this rule is actually protecting —
// a script in this repo produces it, and nothing silently destroys it (the
// normalizer only ever reads it) — so it is named here rather than exempted by
// shape. Anything else claiming to be a second input needs the same scrutiny
// this entry got, which is why it is one name and not a pattern.
const ALLOWED_INPUTS = new Map([
  ['data/prices.json', 'scraper/fetch_prices.py'],
]);

// Committed files under data/ written by a generator in this repo that is NOT
// normalize.py. The site serves a second festival whose programme has its own
// one-shot scrape, and normalize.py neither writes nor reads that file — so it
// satisfies what this rule protects (a script in the repo produces it, and
// nothing silently destroys it) without being an input.
//
// Named, not shaped: a second festival's directory is exactly the moment a
// human should confirm the producer really writes what is in it, so a file that
// merely sits beside an allowed one still trips the rule.
const ALLOWED_OUTPUTS = new Map([
  ['data/jerusalem/shows.json', 'scraper/jerusalem/fetch.py'],
]);

// The bulky raw scrape caches are git-ignored (`.gitignore`) precisely because
// each is regenerable by the scraper that fills it. One reaches the tree only
// via a deliberate `git add -f`, so it gets its own finding: the fix is to
// un-stage it, not to delete data the site needs.
const RAW_CACHES = new Map([
  ['data/raw_pages/', 'scraper/fetch_shows.py'],
  ['data/jerusalem/raw_pages/', 'scraper/jerusalem/fetch.py'],
]);

const rule = {
  id: 'edfringe-data-dir-is-generator-output',
  severity: 'blocking',
  description: "Every committed file under data/ is one of scraper/normalize.py's outputs — no hand-made files, no probe dumps, no raw cache",
  why:
    'data/ is generator output that the browser fetches and the next refresh-shows run rewrites wholesale, so a file that the normalizer does not produce is either silently served to users or silently destroyed — and either way the thing that produced it is not in the repo',
  doc: 'RULES.md',

  run(ctx) {
    const out = [];
    for (const f of ctx.files.filter((p) => p.startsWith('data/')).sort()) {
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
        `delete ${f} — everything under data/ is scraper/normalize.py's output (data/venues.json, data/normalized/*.json, data/days/*.json), plus the named scraper inputs (${[...ALLOWED_INPUTS.keys()].join(', ')}) and the named outputs of this repo's other generators (${[...ALLOWED_OUTPUTS.keys()].join(', ')}). A probe informs the normalizer, it does not feed it: fix scraper/normalize.py and re-run it instead. If normalize.py genuinely writes ${f} now, add its shape to this check's allowlist in the same commit; if another scraper in this repo produces it, add it to ALLOWED_INPUTS or ALLOWED_OUTPUTS naming that script`,
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
    what: `${file} is under data/ but is not something a generator in this repo produces`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
