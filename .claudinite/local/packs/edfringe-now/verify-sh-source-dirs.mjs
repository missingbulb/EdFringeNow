// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

const VERIFY = 'scripts/verify.sh';

// The `git ls-files 'js' 'plan' 'shared'` call in verify.sh's "JavaScript
// syntax" step — captures its quoted top-level-directory arguments.
const LS_FILES_DIRS = /git ls-files((?:\s+'[^']*')+)/;
const JS_FILE = /\.m?js$/;

const rule = {
  id: 'edfringe-verify-sh-covers-source-dirs',
  severity: 'blocking',
  description:
    'scripts/verify.sh\'s JavaScript syntax-check step names every top-level directory that has committed .js/.mjs source',
  why:
    'the step only walks the top-level directories named in its `git ls-files` call; a source directory left off that list is silently never parse-checked, in the pre-commit hook or in CI',
  doc: 'RULES.md',

  run(ctx) {
    const verifyRaw = ctx.read(VERIFY);
    if (verifyRaw === null) return []; // relevance-first: no gate script, nothing to check

    const m = LS_FILES_DIRS.exec(verifyRaw);
    const listed = new Set((m ? m[1].match(/'([^']*)'/g) : []).map((s) => s.slice(1, -1)));

    const present = new Set();
    for (const f of ctx.files) {
      if (!JS_FILE.test(f)) continue;
      const slash = f.indexOf('/');
      if (slash === -1) continue; // a bare top-level file, not inside a directory
      const top = f.slice(0, slash);
      if (top.startsWith('.')) continue; // hidden/tooling dirs (.claudinite, .github, ...) are out of scope
      present.add(top);
    }

    const missing = [...present].filter((d) => !listed.has(d)).sort();
    if (missing.length === 0) return [];

    const plural = missing.length > 1;
    return [finding(
      `${missing.join(', ')} ${plural ? 'have' : 'has'} committed .js/.mjs files but ${plural ? "aren't" : "isn't"} named in ${VERIFY}'s \`git ls-files\` syntax-check step`,
      `add ${missing.map((d) => `'${d}'`).join(' ')} to the \`git ls-files\` call in ${VERIFY} — or, if the directory is deliberately excluded (vendored/generated content), extend its grep -v filter instead`,
    )];
  },
};

function finding(what, fix) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file: VERIFY,
    line: null,
    what,
    why: rule.why,
    fix,
    doc: rule.doc,
  };
}

export default rule;
