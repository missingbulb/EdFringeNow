import testGlobsInStep from './test-globs-in-step.mjs';

// EdFringeNow's own local pack: project-specific working rules captured in this
// repo, layered on the shared Claudinite canon. Declaration-authoritative (no
// structural fingerprint). Its RULES.md is injected wherever this pack is declared,
// and its checks run against the tree.
export default {
  id: 'edfringe',
  detect: null,
  marker: null,
  prose: 'RULES.md',
  rules: [testGlobsInStep],
};
