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

// The bulky raw scrape cache is git-ignored (`.gitignore`) precisely because it
// is regenerable by `scraper/fetch_shows.py`. It reaches the tree only via a
// deliberate `git add -f`, so it gets its own finding: the fix is to un-stage
// it, not to delete data the site needs.
const RAW_CACHE = 'data/raw_pages/';

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
      if (f.startsWith(RAW_CACHE)) {
        out.push(finding(f,
          `${f} is the git-ignored raw scrape cache — un-track it (\`git rm --cached ${f}\`); scraper/fetch_shows.py regenerates it, so it is never committed`,
        ));
        continue;
      }
      if (ALLOWED_FILES.has(f) || ALLOWED_PATTERNS.some((re) => re.test(f))) continue;
      out.push(finding(f,
        `delete ${f} — everything under data/ is scraper/normalize.py's output (data/venues.json, data/normalized/*.json, data/days/*.json). A probe informs the normalizer, it does not feed it: fix scraper/normalize.py and re-run it instead. If normalize.py genuinely writes ${f} now, add its shape to this check's allowlist in the same commit`,
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
    what: `${file} is under data/ but is not something scraper/normalize.py produces`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
