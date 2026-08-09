// Client-side delivery practices for a site served with no server of its own —
// GitHub Pages, S3, a bare CDN — where the host owns `Cache-Control` and the
// freshness policy has to live in the client instead.
//
// Nothing here is EdFringeNow-specific: it is written to be promoted to shared
// canon verbatim, and lives local only because shared packs are vendored from
// upstream and would lose it on the next re-vendor.
//
// Prose-only, like the shared `html` pack: these are judgements about a design,
// not shapes a check can read off the tree. Declaration-authoritative
// (detect: null skips the drift check in both directions).
export default {
  id: 'static-website',
  ruleRoutingGuidance: {
    belongs: 'delivering a static site to the browser — client-side caching and eviction, published manifests, splitting a payload across files that are later joined, and what to do when data is missing',
    excludes: 'hand-authored markup gotchas — those are html; this repo\'s own scrape and wire formats — those are edfringe-data',
  },
  detect: null,
  marker: null,
  prose: 'RULES.md',
  worldRules: [],
  skills: [],
};
