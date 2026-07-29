// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// The pinned Node 22 detects a .js file's module syntax on its own — no
// package.json needed to mark a directory as ESM. `plan/package.json` predates
// that detection and stays only as a grandfathered no-op; it must not become a
// pattern copied into every new source directory.
const ALLOWED = new Set(['package.json', 'plan/package.json']);

const rule = {
  id: 'edfringe-no-stray-package-json',
  severity: 'advisory',
  description: 'No package.json exists outside the repo root and the grandfathered plan/package.json',
  why:
    'a package.json is not needed to mark a directory as ESM — the pinned Node 22 detects module syntax in a .js file on its own — so a new one is very likely a copy of the plan/ leftover rather than something that does anything',
  doc: 'RULES.md',

  run(ctx) {
    const stray = ctx.files.filter((f) => f.endsWith('/package.json') && !ALLOWED.has(f)).sort();
    if (stray.length === 0) return [];

    return stray.map((f) => finding(f,
      `${f} is not needed to mark its directory as ESM (node --check and the test suite already detect module syntax unaided) — remove it, unless it genuinely configures its own dependencies/scripts`,
    ));
  },
};

function finding(file, fix) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line: null,
    what: `${file} is a package.json outside the repo root and plan/`,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
