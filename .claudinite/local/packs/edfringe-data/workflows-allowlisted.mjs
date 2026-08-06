// Dependency-free by design: a local pack's checks must load without the
// vendored mount, so this returns plain finding objects rather than importing
// engine/checks/helpers/findings.mjs.

// This repo once grew "throwaway probe" workflows — push-triggered jobs whose
// whole purpose was to reach the edfringe API from an open-network Actions
// runner because the session sandbox blocks it. Five of them are still
// registered in the Actions tab as orphans. The sandbox egress block is a
// policy boundary, not an obstacle: CI must not be a side channel around it.
// So the workflow directory is closed by default — every file under
// .github/workflows/ is named here, and a new one fails checks until a human
// adds it to this list in the same commit, which is exactly the moment the
// "should this thing run with open egress?" question gets asked out loud.
const ALLOWED_WORKFLOWS = new Set([
  '.github/workflows/ci.yml',                   // tests + syntax on push/PR
  '.github/workflows/claudinite-checks-ci.yml', // working-guidelines conformance sweep
  '.github/workflows/claudinite-scheduler.yml', // the repo's only cron (scheduled tasks)
  '.github/workflows/pages.yml',                // deploy to GitHub Pages
  '.github/workflows/prices.yml',               // sanctioned one-off price fetch (manual dispatch)
  '.github/workflows/scrape.yml',               // sanctioned full scrape (manual dispatch)
]);

const rule = {
  id: 'edfringe-workflows-allowlisted',
  severity: 'blocking',
  description: 'Every file under .github/workflows/ is on the sanctioned allowlist — no ad-hoc probe or data-fetch workflows',
  why:
    'an Actions runner has open network egress while sessions deliberately do not, so an unreviewed workflow file is a standing bypass of the sandbox network policy; the retired probe-edfringe-api practice left orphaned workflows behind and this check is what retired it for good',
  doc: 'RULES.md',

  run(ctx) {
    const out = [];
    for (const f of ctx.files.filter((p) => p.startsWith('.github/workflows/')).sort()) {
      if (ALLOWED_WORKFLOWS.has(f)) continue;
      out.push({
        rule: rule.id,
        severity: rule.severity,
        file: f,
        line: null,
        what: `${f} is a workflow file not on the sanctioned allowlist`,
        why: rule.why,
        fix:
          `delete ${f} — one-off data fetches and API probes do not get ad-hoc workflows; the egress block is policy, and everything the live API ever answered is recorded in scraper/SCRAPING.md. If this is a genuinely new sanctioned workflow, the repo owner adds it to ALLOWED_WORKFLOWS in workflows-allowlisted.mjs in the same commit`,
        doc: rule.doc,
      });
    }
    return out;
  },
};

export default rule;
