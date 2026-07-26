// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

const DAY_FILE = /^data\/days\/\d{4}-\d{2}-\d{2}\.json$/;
const MASTER = 'data/normalized/shows.min.json';
const LOOKUPS = 'data/venues.json';

// Per file, so one systematically shifted lookup list reports a readable handful
// instead of thousands of identical lines.
const MAX_PER_FILE = 5;

const rule = {
  id: 'edfringe-lookup-indices',
  severity: 'blocking',
  description:
    'Every genre / room / subgenre / ticket-status / age-restriction index in the committed day files and shows.min.json resolves inside the matching data/venues.json lookup list',
  why:
    'the wire format ships the lookup lists once and references them by position, so an index the list no longer has (or a list regenerated without its day files) mislabels shows silently — the client renders undefined, or worse, the neighbouring genre',
  doc: 'scraper/README.md',

  run(ctx) {
    const raw = ctx.read(LOOKUPS);
    if (raw === null) return []; // relevance-first: no data layer in this repo state

    let lookups;
    try {
      lookups = JSON.parse(raw);
    } catch (e) {
      return [finding(LOOKUPS, `data/venues.json is not valid JSON: ${e.message}`,
        'regenerate it with `python3 scraper/normalize.py` rather than hand-editing')];
    }

    const out = [];
    const len = (name) => (Array.isArray(lookups[name]) ? lookups[name].length : 0);

    // The producer is scraper/normalize.py (build_day_files / minify_master); the
    // consumers are js/app.js adaptShow and plan/lib/hydrate.js rehydrateShows.
    // Day-file field -> venues.json list. `room` and `ts` carry -1 for "unknown"
    // (normalize.py writes -1; adaptShow resolves it to no room / no status).
    const dayFields = [
      ['genre', 'genres', false],
      ['room', 'rooms', true],
      ['ts', 'ticketStatuses', true],
    ];
    // shows.min.json's shorter keys, same lists.
    const masterFields = [
      ['g', 'genres', false],
      ['rm', 'rooms', true],
      ['ar', 'ageRestrictions', true],
    ];

    function finding(file, what, fix) {
      return {
        rule: rule.id,
        severity: rule.severity,
        file,
        line: null,
        what,
        why: rule.why,
        fix,
        doc: rule.doc,
      };
    }

    function checkIndex(found, label, value, list, allowMissing) {
      if (value === undefined || value === null) return;
      if (!Number.isInteger(value)) {
        found.push([label, `${label} is ${JSON.stringify(value)}, not an integer index`]);
        return;
      }
      if (allowMissing && value === -1) return;
      if (value < 0 || value >= len(list)) {
        found.push([label, `${label} = ${value} is outside venues.json "${list}" (${len(list)} entries)`]);
      }
    }

    function checkRecords(file, records, fields, subKey, statusOf) {
      const found = [];
      records.forEach((rec, i) => {
        if (found.length >= MAX_PER_FILE) return;
        if (!rec || typeof rec !== 'object') return;
        const at = `record #${i}${rec.title ? ` (${rec.title})` : rec.t ? ` (${rec.t})` : ''}`;
        for (const [key, list, allowMissing] of fields) {
          checkIndex(found, `${at} ${key}`, rec[key], list, allowMissing);
        }
        for (const s of rec[subKey] ?? []) {
          checkIndex(found, `${at} ${subKey}[]`, s, 'subgenres', false);
        }
        for (const [label, value] of statusOf(rec, at)) {
          checkIndex(found, label, value, 'ticketStatuses', true);
        }
      });
      for (const [, what] of found.slice(0, MAX_PER_FILE)) {
        out.push(finding(file, what,
          'regenerate the data layer together — `python3 scraper/normalize.py` (add --merge for a top-up) rewrites venues.json and every day file from the master in one pass; never edit either side alone'));
      }
    }

    for (const file of ctx.files.filter((f) => DAY_FILE.test(f))) {
      const text = ctx.read(file);
      if (text === null) continue;
      let records;
      try {
        records = JSON.parse(text);
      } catch (e) {
        out.push(finding(file, `day file is not valid JSON: ${e.message}`,
          'regenerate it with `python3 scraper/normalize.py`'));
        continue;
      }
      if (!Array.isArray(records)) {
        out.push(finding(file, 'a day file must be a plain array of show records',
          'regenerate it with `python3 scraper/normalize.py`'));
        continue;
      }
      // A day record is one performance: its ticket status is the flat `ts`,
      // already covered by dayFields, so no per-performance list here.
      checkRecords(file, records, dayFields, 'subs', () => []);
    }

    const masterText = ctx.files.includes(MASTER) ? ctx.read(MASTER) : null;
    if (masterText !== null) {
      let records;
      try {
        records = JSON.parse(masterText);
      } catch (e) {
        out.push(finding(MASTER, `shows.min.json is not valid JSON: ${e.message}`,
          'regenerate it with `python3 scraper/normalize.py`'));
        return out;
      }
      if (Array.isArray(records)) {
        // The master keeps every performance, each with its own ticket status `t`.
        checkRecords(MASTER, records, masterFields, 'sg', (rec, at) =>
          (rec.p ?? []).map((p, j) => [`${at} p[${j}].t`, p && p.t]));
      }
    }

    return out;
  },
};

export default rule;
