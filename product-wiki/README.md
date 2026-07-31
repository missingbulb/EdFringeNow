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
  Fringe discovery/planning tools, split by which of the product's two questions
  they answer, and where each gap is.
- **[market-and-audience/](market-and-audience/README.md)** — festival scale, the
  overwhelm problem, and the two audiences the product targets: the live
  in-festival crowd and the trip planners.
- **[audience-divergence/](audience-divergence/README.md)** — where those two
  crowds' requirements pull apart, where they actively conflict, and the narrow
  spine they share.
- **[festival-season/](festival-season/README.md)** — the other Edinburgh
  festivals in August and across the summer: their scale, diversity, locations,
  the six different shapes an "event" takes across them, and whether the data is
  reachable.
- **[fringe-ticketing/](fringe-ticketing/README.md)** — who actually sells a
  Fringe ticket (the Society, the venues, edfest.com), the definitive operator
  census, why no third party can sell or earn commission on tickets, and why
  the edfringe scrape has no full replacement.
- **[festival-cities-beyond-edinburgh/](festival-cities-beyond-edinburgh/README.md)** —
  the same question pointed outward: which *other cities* carry the
  Edinburgh-in-August pattern, ranked by how close they are structurally rather
  than by fame, plus the candidate tail.
