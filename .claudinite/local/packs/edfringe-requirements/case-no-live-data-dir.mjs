// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// The frozen-fixture guarantee ("The fixture freeze" in RULES.md) only holds
// while every case lets `newPage()` default `dataDir` to the committed
// `shared/fixtures/data/` snapshot (`shared/harness/browser.js`). That option
// exists so a caller CAN point the harness at a different dataset — no
// runner threads a case's own `dataDir` through today, so this is currently a
// dead property on every case, but it is the one sanctioned surface through
// which a case could reach around the freeze at the live, nightly-refreshed
// `data/` files the moment a runner starts forwarding it. Catching the
// declaration now is cheaper than catching the bypass later.
const CASE_FILE = /^product\/requirements\/(screen|logic|behavior)\/cases\/[^/]+\.case\.(js|mjs)$/;
const DATA_DIR_KEY = /(^|[^.\w$])dataDir\s*:/;

const rule = {
  id: 'edfringe-requirements-case-no-live-data-dir',
  severity: 'advisory',
  description:
    'No requirements case file (screen/logic/behavior) declares its own `dataDir` — every case renders against the frozen shared/fixtures/data snapshot',
  why:
    'the harness only compares goldens under the exact frozen fixture dataset; a case that supplies its own `dataDir` reaches past that freeze at the live, nightly-refreshed data/ files, so the moment a runner starts forwarding case options through to newPage() its golden silently stops being a faithful pixel record of a fixed input',
  doc: 'RULES.md',

  run(ctx) {
    const out = [];
    for (const f of ctx.files.filter((p) => CASE_FILE.test(p)).sort()) {
      const text = ctx.read(f);
      if (text === null) continue;
      const hit = text.split('\n').some((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
        return DATA_DIR_KEY.test(line);
      });
      if (!hit) continue;
      out.push(finding(f));
    }
    return out;
  },
};

function finding(file) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line: null,
    what: `${file} declares its own \`dataDir\`, reaching around the frozen shared/fixtures/data snapshot`,
    why: rule.why,
    fix:
      'remove the `dataDir` override — every case renders against the committed shared/fixtures/data snapshot by default (shared/harness/browser.js newPage()); if the case genuinely needs a different frozen cast, extend build-fixtures.js and get the change owner-approved as a re-baselining, never point a case at data/ live files',
    doc: rule.doc,
  };
}

export default rule;
