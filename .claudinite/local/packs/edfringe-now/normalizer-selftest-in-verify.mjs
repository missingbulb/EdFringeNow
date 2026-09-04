// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

const VERIFY = 'scripts/verify.sh';
const NORMALIZER = 'scraper/normalize.py';
const SELFTEST = '--selftest';

// Scoped parse rather than a grep: verify.sh labels the step
// `step "Normalizer self-test — normalize.py --selftest"`, so a plain grep for
// the two tokens passes even after the real invocation is deleted — the label
// alone would satisfy it. Drop comment lines and the quoted argument of every
// `step` call, then look for a surviving command line.
function commandLines(sh) {
  return sh
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => l.replace(/\bstep\s+(["'])(?:(?!\1).)*\1/g, ''))
    // A trailing comment can carry the tokens too (`node --check  # not normalize.py --selftest`).
    .map((l) => l.replace(/\s#.*$/, ''));
}

const rule = {
  id: 'edfringe-normalizer-selftest-in-verify',
  severity: 'blocking',
  description: "scripts/verify.sh runs the normalizer's offline self-test (python3 scraper/normalize.py --selftest)",
  why:
    "the live edfringe API is unreachable from a session, so the normalizer self-test is the ONE transform check that runs offline — drop it from the gate and every scraper change ships with no verification at all, in a repo where nothing else can stand in for it",
  doc: 'RULES.md',

  run(ctx) {
    // Relevance-first: no normalizer, or one with no self-test to run, is not
    // this rule's business.
    if (!ctx.files.includes(NORMALIZER)) return [];
    const normalizer = ctx.read(NORMALIZER);
    if (normalizer === null || !normalizer.includes(SELFTEST)) return [];

    const sh = ctx.files.includes(VERIFY) ? ctx.read(VERIFY) : null;
    if (sh === null) return []; // relevance-first: no verification gate in this tree

    const wired = commandLines(sh).some((l) => l.includes('normalize.py') && l.includes(SELFTEST));
    if (wired) return [];

    return [{
      rule: rule.id,
      severity: rule.severity,
      file: VERIFY,
      line: null,
      what: `${NORMALIZER} supports ${SELFTEST} but ${VERIFY} never invokes it (a step label naming it does not count — only a command line does)`,
      why: rule.why,
      fix: `restore the step to ${VERIFY}: \`python3 ${NORMALIZER} ${SELFTEST}\` — both the pre-commit hook and CI run that script, so this is the only place wiring it makes it a gate`,
      doc: rule.doc,
    }];
  },
};

export default rule;
