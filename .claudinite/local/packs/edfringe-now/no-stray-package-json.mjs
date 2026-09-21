// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// One package.json marks the whole ES-module tree — `site/package.json` — and
// the repo root carries the project's own. A third one is a copy of that
// pattern into a directory the second already covers, and buys nothing.

const ALLOWED = new Set(['package.json', 'site/package.json']);

const rule = {
  id: 'edfringe-no-stray-package-json',
  severity: 'advisory',
  description: 'No package.json exists outside the repo root and site/, which declares the ES-module tree',
  why:
    'site/package.json already declares every source under it an ES module, so a package.json in one of its subdirectories re-states what it inherits — and one outside site/ marks a tree that has no module type to declare',
  doc: 'RULES.md',

  run(ctx) {
    const stray = ctx.files.filter((f) => f.endsWith('/package.json') && !ALLOWED.has(f)).sort();
    if (stray.length === 0) return [];

    return stray.map((f) => finding(f,
      `${f} adds nothing site/package.json does not already give its directory — remove it, unless it genuinely configures its own dependencies/scripts`,
    ));
  },
};

function finding(file, fix) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line: null,
    what: `${file} is a package.json outside the repo root and site/`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
