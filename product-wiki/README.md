# product-wiki

Agent-maintained market, user, and competitor research for EdFringeNow, kept as
self-growing wikis under this directory (compile findings once, refine in place,
cite everything). This tree is **walled off from the app code** — nothing in the
repo may reference `product-wiki/` except the reviewed distillation under
`product-requirements/`, so no code silently depends on unreviewed research.

## What lives here

- **`product-requirements/`** — the human-reviewed distillation of the wikis into
  product requirements. The only `product-wiki/` content the rest of the repo may
  reference. Never auto-grown.
- **`sample-data/`** — small illustrative assets a wiki claim points to (created
  when first needed; never test fixtures).
- **Everything else** — wiki space. A wiki is a folder with a `README.md`
  carrying `## Sources`, `## Open questions`, and `## Growth log`. The weekly
  growth pass researches each wiki's own open questions and writes back cited.

## Wikis

- **[competitor-landscape/](competitor-landscape/README.md)** — the existing
  Fringe discovery/planning tools and where the reachability gap is.
- **[market-and-audience/](market-and-audience/README.md)** — festival scale, the
  overwhelm problem, and the audience segments the product targets.
