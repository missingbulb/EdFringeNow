// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// A local task's worker script: .claudinite/local/packs/<pack>/tasks/<task>/worker.sh
// (the legacy .claudinite/local_packs/ path is accepted during the rename window).
const WORKER = /^\.claudinite\/local(?:\/packs|_packs)\/[^/]+\/tasks\/[^/]+\/worker\.sh$/;

// The writing acts this check cares about — a worker that only reads can be left
// wherever the scheduler put it.
const WRITES = /^[^#\n]*\bgit\s+(?:commit|push)\b/m;

// Restoring the checkout: `git checkout main` / `git switch main`, ignoring comments.
const RESTORES = /^[^#\n]*\bgit\s+(?:checkout|switch)\s+main\b/m;

const rule = {
  id: 'edfringe-worker-restores-main',
  severity: 'blocking',
  description:
    'a local task worker that commits or pushes returns the checkout to `main` first',
  why:
    'the Claudinite scheduler runs every due task in ONE checkout, and a task ordered after a delivering `basics/baselining` inherits the maintenance branch its deliver() left behind (`git checkout -B`, never switched back) — an upstream-less branch whose bare push aborts with exit 128, which is how #141 and #231 each silently stopped a data refresh for days',
  doc: 'RULES.md',

  run(ctx) {
    const findings = [];

    for (const file of ctx.files) {
      if (!WORKER.test(file)) continue;

      const src = ctx.read(file);
      if (src === null) continue; // relevance-first: unreadable, not this check's business

      const write = WRITES.exec(src);
      if (!write) continue; // a read-only worker cannot lose a commit to the wrong branch

      const restore = RESTORES.exec(src);

      if (!restore) {
        findings.push(finding(
          file,
          'commits or pushes without ever returning the checkout to `main`',
        ));
        continue;
      }

      if (restore.index > write.index) {
        findings.push(finding(
          file,
          'returns the checkout to `main` only after it has already committed or pushed',
        ));
      }
    }

    return findings.sort((a, b) => a.file.localeCompare(b.file));
  },
};

function finding(file, what) {
  return {
    rule: rule.id,
    severity: rule.severity,
    file,
    line: null,
    what: `${file} ${what}`,
    why: rule.why,
    fix:
      'before the worker writes anything, add the guard the refresh-shows / refresh-tickets workers carry: ' +
      'read `git rev-parse --abbrev-ref HEAD` and `git checkout main` when it is anything else. ' +
      'Do not reach for `git push origin HEAD:main` instead — from a polluted checkout that pushes ' +
      "baselining's unreviewed converge straight to main, past its own maintenance PR.",
    doc: rule.doc,
  };
}

export default rule;
