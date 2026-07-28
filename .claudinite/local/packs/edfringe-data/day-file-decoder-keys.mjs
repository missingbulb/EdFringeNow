// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.
//
// The day files and `js/app.js` adaptShow are a producer/decoder pair with no
// shared schema between them. This check closes the half of the wire-format rule
// that nothing used to catch: a decoder left reading a key the producer no
// longer writes. It compares what adaptShow *reads* against what the committed
// day files actually *carry*.
//
// Scoped parsing, not grep: `entry.<key>` is only meaningful inside adaptShow's
// own body, so the check extracts that body by brace balance and strips comments
// before matching. Grepping the whole file would mistake the doc comment above
// the function — which names the fields in prose — for real field reads.

const DAY_FILE = /^data\/days\/\d{4}-\d{2}-\d{2}\.json$/;
const APP = 'js/app.js';
const DECODER = 'adaptShow';

// The decoder's parameter name for one day-file record. adaptShow(entry, ...).
const RECORD_PARAM = 'entry';

const rule = {
  id: 'edfringe-day-file-decoder-keys',
  severity: 'blocking',
  description:
    'Every day-file field js/app.js adaptShow reads is a field the committed data/days/*.json records actually carry',
  why:
    'the per-day wire format has one producer (scraper/normalize.py build_day_files) and one decoder (adaptShow) with nothing tying them together — rename or drop a field on the producer side and the decoder silently reads undefined, so the Now page renders blank genres, missing rooms or a wrong availability stamp without failing a test or a parse check',
  doc: 'scraper/README.md',

  run(ctx) {
    const app = ctx.files.includes(APP) ? ctx.read(APP) : null;
    if (app === null) return []; // relevance-first: no Now page in this repo state

    const body = decoderBody(app);
    if (body === null) return []; // no adaptShow here — nothing this rule can speak to

    const readKeys = fieldReads(body);
    if (readKeys.size === 0) return [];

    // What the wire format actually ships: the union of keys across every
    // committed day file. A union rather than one file's keys because a field
    // can legitimately be absent from a record (normalize.py omits `blurb`
    // entirely, and optional fields simply do not appear on some shows).
    const present = new Set();
    let records = 0;
    for (const file of ctx.files.filter((f) => DAY_FILE.test(f))) {
      const text = ctx.read(file);
      if (text === null) continue;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue; // malformed day files are edfringe-lookup-indices' finding, not this one
      }
      if (!Array.isArray(parsed)) continue;
      for (const rec of parsed) {
        if (!rec || typeof rec !== 'object') continue;
        records += 1;
        for (const k of Object.keys(rec)) present.add(k);
      }
    }
    // No day data in the tree (or every file empty) ⇒ nothing to compare against.
    // Staying quiet here is what keeps the rule from firing on a fresh checkout.
    if (records === 0) return [];

    const missing = [...readKeys].filter((k) => !present.has(k)).sort();
    return missing.map((key) => ({
      rule: rule.id,
      severity: rule.severity,
      file: APP,
      line: null,
      what: `${DECODER} reads \`${RECORD_PARAM}.${key}\`, but no committed day file record has a "${key}" field (they carry: ${[...present].sort().join(', ')})`,
      why: rule.why,
      fix: `either restore the field on the producer — scraper/normalize.py \`build_day_files\` writes the day-file record — and regenerate (\`python3 scraper/normalize.py\`), or update ${DECODER} to read the field's new name. The wire format moves as one commit: producer, this decoder, and plan/lib/hydrate.js.`,
      doc: rule.doc,
    }));
  },
};

/** The source of adaptShow's body, comments stripped — or null if it isn't there.
 *
 * Brace-balanced from the function's opening `{` so that nested object literals
 * and blocks end up inside, and everything after the function ends up outside.
 * The parameter list is walked by paren balance first: adaptShow destructures
 * its second argument, so the first `{` after the name is the *parameter*
 * object, not the body — taking it would silently read zero fields and make the
 * whole check a no-op. */
function decoderBody(src) {
  const sig = new RegExp(`function\\s+${DECODER}\\s*\\(`).exec(src);
  if (!sig) return null;

  let params = 1;
  let i = sig.index + sig[0].length;
  for (; i < src.length && params > 0; i += 1) {
    if (src[i] === '(') params += 1;
    else if (src[i] === ')') params -= 1;
  }
  if (params !== 0) return null; // unbalanced signature — unparseable, not guessed

  const open = src.indexOf('{', i);
  if (open === -1) return null;

  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return stripComments(src.slice(open + 1, i));
    }
  }
  return null; // unbalanced — treat as unparseable rather than guessing
}

/** Remove `//` line comments and block comments so prose naming a field is not
 *  mistaken for code reading it. Deliberately simple: the check only needs the
 *  identifiers after `entry.`, and a `//` inside a string would at worst hide a
 *  read (quiet), never invent one (a false alarm). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** The set of day-file field names the decoder body reads off its record param. */
function fieldReads(body) {
  const out = new Set();
  const re = new RegExp(`\\b${RECORD_PARAM}\\.([A-Za-z_$][\\w$]*)`, 'g');
  let m;
  while ((m = re.exec(body)) !== null) out.add(m[1]);
  return out;
}

export default rule;
