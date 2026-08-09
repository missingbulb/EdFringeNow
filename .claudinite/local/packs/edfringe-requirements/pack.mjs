// EdFringeNow's executable-requirements harness pack: the project-specific
// process elements the shared executable-requirements / spec-driven-product
// packs don't carry — the real-browser (Playwright) golden harness, the frozen
// fixture policy, and how golden approval runs in this repo. Work procedure
// only; product behaviour belongs in product/requirements.md.
export default {
  id: 'edfringe-requirements',
  ruleRoutingGuidance: {
    belongs:
      "the executable-requirements harness of this repo: the Playwright golden lanes, browser-determinism recipe, fixture freeze, and the golden-approval procedure's local mechanics",
    excludes:
      'product behaviour (product/requirements.md and its cases); general repo working rules — edfringe; the data pipeline — edfringe-data',
  },
  detect: null,
  marker: null,
  prose: 'RULES.md',
};
