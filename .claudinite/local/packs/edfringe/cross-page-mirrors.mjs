// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.
//
// Converted from this pack's RULES.md ("The site is two independent front-ends
// — cross-page behaviour lives twice"). The Now page (js/app.js, a *classic*
// script) and the planner (plan/plan.js, an ES module) share no code, so a value
// both pages must agree on exists as two copies and drifts silently when a
// change lands in one. Canon's `shared-constants` guard can't hold this: it
// rejects an entry whose watched files are all import-capable (both are `.js`)
// on the grounds that they should share an import — true in general, not here,
// because index.html loads app.js without `type="module"`.
//
// Parsed, not grepped: the object literal is located by its declaration and read
// as key/value pairs, so a mention of `UK_BOUNDS` in a comment or a differently
// formatted (reordered keys, rewrapped lines, changed comment) copy can't raise
// a false alarm — only a real difference in the values does.

// The mirrored declarations. One entry per value that must be identical in both
// files; add a row when a new cross-page constant is copied.
const MIRRORS = [
  {
    name: 'UK_BOUNDS',
    files: ['js/app.js', 'plan/plan.js'],
    what: 'the UK-mainland bounding box that gates the location guard (Now) and the debug menu (Plan)',
  },
];

/** Text of the `{...}` object literal assigned to `const <name> =`, or null. */
function objectLiteralOf(text, name) {
  const decl = new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${name}\\s*=\\s*\\{`);
  const m = decl.exec(text);
  if (!m) return null;
  const open = text.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        return { body: text.slice(open + 1, i), line: text.slice(0, open).split('\n').length };
      }
    }
  }
  return null; // unbalanced — the file doesn't parse anyway
}

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Split on commas that are not inside a nested brace/bracket/paren or string. */
function topLevelParts(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{' || c === '[' || c === '(') depth += 1;
    else if (c === '}' || c === ']' || c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * The literal's key -> value map. Values are normalised numerically when they
 * are numeric literals (so `49.8` and `49.80` are the same value, not drift) and
 * kept as collapsed source text otherwise — nothing here needs to *evaluate* the
 * file, only to tell two copies apart.
 */
function pairsOf(body) {
  const map = new Map();
  for (const part of topLevelParts(stripComments(body))) {
    const m = /^(?:(['"])([^'"]+)\1|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/.exec(part);
    if (!m) {
      map.set(part.replace(/\s+/g, ' '), '<unparsed>'); // shorthand / spread — compared as text
      continue;
    }
    const key = m[2] ?? m[3];
    const raw = m[4].trim();
    const num = Number(raw);
    map.set(key, raw !== '' && Number.isFinite(num) ? String(num) : raw.replace(/\s+/g, ' '));
  }
  return map;
}

const rule = {
  id: 'edfringe-cross-page-mirrors',
  severity: 'blocking',
  description:
    'A constant the Now page and the planner both copy (they share no code) holds the same values in js/app.js and plan/plan.js',
  why:
    'the two front-ends share no modules and no globals, so a mirrored value changed on one page and not the other leaves the pages silently disagreeing — the copy that was not updated keeps the old behaviour and nothing else fails',
  doc: '.claudinite/local/packs/edfringe/RULES.md',

  run(ctx) {
    const out = [];

    const finding = (file, line, what, fix) => ({
      rule: rule.id,
      severity: rule.severity,
      file,
      line,
      what,
      why: rule.why,
      fix,
      doc: rule.doc,
    });

    for (const mirror of MIRRORS) {
      // Relevance-first: only a tree that has both pages can mirror anything.
      if (!mirror.files.every((f) => ctx.files.includes(f))) continue;

      const seen = [];
      for (const file of mirror.files) {
        const text = ctx.read(file);
        if (text === null) break;
        seen.push({ file, literal: objectLiteralOf(text, mirror.name) });
      }
      if (seen.length !== mirror.files.length) continue;

      const present = seen.filter((s) => s.literal);
      if (present.length === 0) continue; // dropped from both pages — nothing to mirror
      if (present.length !== seen.length) {
        const missing = seen.filter((s) => !s.literal).map((s) => s.file);
        const home = present[0];
        out.push(finding(home.file, home.literal.line,
          `${mirror.name} is declared in ${present.map((s) => s.file).join(', ')} but not in ${missing.join(', ')} — ${mirror.what}`,
          `restore the mirrored ${mirror.name} in ${missing.join(', ')}, or drop it from both pages and remove its row from MIRRORS in this check`));
        continue;
      }

      const [first, ...rest] = present.map((s) => ({ ...s, pairs: pairsOf(s.literal.body) }));
      for (const other of rest) {
        const keys = [...new Set([...first.pairs.keys(), ...other.pairs.keys()])].sort();
        const diffs = keys
          .filter((k) => first.pairs.get(k) !== other.pairs.get(k))
          .map((k) => `${k}: ${first.pairs.has(k) ? first.pairs.get(k) : '(absent)'} in ${first.file} vs ${other.pairs.has(k) ? other.pairs.get(k) : '(absent)'} in ${other.file}`);
        if (diffs.length === 0) continue;
        out.push(finding(other.file, other.literal.line,
          `${mirror.name} differs between the two front-ends — ${diffs.join('; ')}`,
          `the pages share no code, so ${mirror.name} is copied on purpose: apply the same change to every copy (${mirror.files.join(', ')})`));
      }
    }

    return out;
  },
};

export default rule;
