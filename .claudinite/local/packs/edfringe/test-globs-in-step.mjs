// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

const PKG = 'package.json';
const VERIFY = 'scripts/verify.sh';

// The `node --test <globs...>` invocation, wherever it appears in a shell script
// or a package.json script string. Anchored per line so verify.sh's prose
// comments above it can mention the command without matching.
const NODE_TEST = /^\s*node --test\s+(.+?)\s*$/m;

// If verify.sh delegates to the package script instead of repeating the globs,
// there is one source of truth and nothing to drift — the check stands down.
const DELEGATES = /\bnpm (?:run )?test\b/;

const rule = {
  id: 'edfringe-test-globs-in-step',
  severity: 'blocking',
  description:
    'The `node --test` file globs in package.json\'s "test" script and in scripts/verify.sh name the same set of test files',
  why:
    'CI and the pre-commit hook run scripts/verify.sh while a developer runs `npm test`, so the same list is spelled twice; a glob added to only one of them means a suite that is green locally and never runs in CI, or one that runs in CI and is invisible to whoever is editing it',
  doc: 'scripts/verify.sh',

  run(ctx) {
    const pkgRaw = ctx.read(PKG);
    const verifyRaw = ctx.read(VERIFY);
    // Relevance-first: a tree without both files has no duplication to guard.
    if (pkgRaw === null || verifyRaw === null) return [];

    let pkg;
    try {
      pkg = JSON.parse(pkgRaw);
    } catch {
      return []; // not this check's business — JSON validity is caught elsewhere
    }

    const script = pkg?.scripts?.test;
    if (typeof script !== 'string') return [];

    const pkgMatch = NODE_TEST.exec(script);
    const verifyMatch = NODE_TEST.exec(verifyRaw);

    // Neither side runs `node --test` from here: nothing is duplicated.
    if (!pkgMatch && !verifyMatch) return [];

    if (pkgMatch && !verifyMatch) {
      if (DELEGATES.test(verifyRaw)) return []; // single-sourced through `npm test`
      return [finding(
        `package.json's "test" script runs \`node --test\` but ${VERIFY} runs no unit tests at all`,
        `add the \`node --test\` line back to ${VERIFY}, or have it call \`npm test\` so the globs live in one place`,
      )];
    }
    if (verifyMatch && !pkgMatch) {
      return [finding(
        `${VERIFY} runs \`node --test\` but package.json's "test" script does not`,
        `point package.json's "test" script at the same globs, or at \`bash ${VERIFY}\``,
      )];
    }

    const inPkg = globs(pkgMatch[1]);
    const inVerify = globs(verifyMatch[1]);
    const onlyPkg = inPkg.filter((g) => !inVerify.includes(g));
    const onlyVerify = inVerify.filter((g) => !inPkg.includes(g));
    if (onlyPkg.length === 0 && onlyVerify.length === 0) return [];

    const parts = [];
    if (onlyPkg.length) parts.push(`only in package.json: ${onlyPkg.join(' ')}`);
    if (onlyVerify.length) parts.push(`only in ${VERIFY}: ${onlyVerify.join(' ')}`);
    return [finding(
      `the \`node --test\` globs have drifted apart — ${parts.join('; ')}`,
      `add the missing glob to both lines (they are meant to be identical), or have ${VERIFY} call \`npm test\` so there is only one list`,
    )];
  },
};

/** The whitespace-separated glob arguments, order-insensitive and de-duped. */
function globs(args) {
  return [...new Set(args.split(/\s+/).filter(Boolean))].sort();
}

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
