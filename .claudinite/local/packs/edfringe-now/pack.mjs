import testGlobsInStep from './test-globs-in-step.mjs';
import verifyShSourceDirs from './verify-sh-source-dirs.mjs';
import noStrayPackageJson from './no-stray-package-json.mjs';
import workerRestoresMain from './worker-restores-main.mjs';
import lookupIndices from './lookup-indices.mjs';
import normalizerSelftestInVerify from './normalizer-selftest-in-verify.mjs';
import dataDirIsGeneratorOutput from './data-dir-is-generator-output.mjs';

// This repo's own pack: everything EdFringeNow has learned about working on
// itself, across the three surfaces that produced any of it — the repo's own
// build steps and conventions, the edfringe.com scrape and the committed data it
// produces, and the Playwright golden harness that runs product/requirements.md
// as tests. Declaration-authoritative (no structural fingerprint).
//
// Consolidated 2026-09-04 from `edfringe`, `edfringe-data` and
// `edfringe-requirements`. The split bought no routing anyone used: all three
// were declared by hand, none was fingerprinted, and a session loaded all three
// together on every turn — so the only thing three manifests separated was which
// file a rule was typed into.
//
// The wider field reference for the scrape stays in scraper/SCRAPING.md and the
// harness's layout and commands in product/requirements/README.md; this pack
// carries the judgment neither of those does.
export default {
  id: 'edfringe-now',
  ruleRoutingGuidance: {
    belongs: "EdFringeNow's own rules: repo conventions, the edfringe.com scrape and data layer, the requirements harness",
    excludes: 'product behaviour — product/requirements.md and its cases; anything that would hold in another repo — the canon',
  },
  detect: null,
  marker: null,
  prose: 'RULES.md',
  worldRules: [
    testGlobsInStep,
    verifyShSourceDirs,
    noStrayPackageJson,
    workerRestoresMain,
    lookupIndices,
    normalizerSelftestInVerify,
    dataDirIsGeneratorOutput,
  ],
};
