import lookupIndices from './lookup-indices.mjs';
import normalizerSelftestInVerify from './normalizer-selftest-in-verify.mjs';
import dataDirIsGeneratorOutput from './data-dir-is-generator-output.mjs';
import workflowsAllowlisted from './workflows-allowlisted.mjs';

// EdFringeNow's data-pipeline pack: the edfringe.com scrape and the committed
// data layer it produces (scraper/, data/). Split out of the general `edfringe`
// pack because it is a distinct domain with its own trigger — you are in it only
// when touching the scraper or the data files, not when working on the UI — and
// it is where this repo's external-API and wire-format knowledge lives.
// Declaration-authoritative like every local pack (no fingerprint).
export default {
  id: 'edfringe-data',
  ruleRoutingGuidance: {
    belongs: 'the edfringe.com scrape and the committed data layer it produces — external-API and wire-format knowledge',
    excludes: 'UI work and general repo working rules — those are edfringe',
  },
  detect: null,
  marker: null,
  prose: 'RULES.md',
  worldRules: [lookupIndices, normalizerSelftestInVerify, dataDirIsGeneratorOutput, workflowsAllowlisted],
  skills: [],
};
