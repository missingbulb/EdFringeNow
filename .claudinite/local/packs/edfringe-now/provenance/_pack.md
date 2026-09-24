## 2026-07-23 · born · the repo's first local pack, edfringe (#85)
- **Source:** the weekly conversation-extract pass over the captured conversation logs (#68, #71,
  #74).
- **Reason:** the pass found a project-specific lesson (visual UI verification is available in this
  sandbox) that no canon pack homes, so it opened a local pack to carry it.
- **Actor:** the conversation-extract run, merged by @missingbulb (owner).
- **Mechanism:** the manifest of `.claudinite/local_packs/edfringe/`, prose-only and
  declaration-authoritative with no structural fingerprint, declared in `.claudinite-checks.json`.
- **Landed:** #85

## 2026-07-26 · moved · local_packs/ to local/packs/ with the scheduler cutover (#101)
- **Reason:** forced by the cutover to the per-repo task scheduler; the declaration token became
  `local/edfringe`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same manifest at `.claudinite/local/packs/edfringe/`.
- **Landed:** #101, Refs missingbulb/Claudinite#394

## 2026-07-27 · scope-changed · the data pipeline split out as edfringe-data (#116)
- **Source:** the weekly growth-discover-packs run (slot w2026-07-26), distilled from
  `scraper/normalize.py` (`build_lookups`, `build_day_files`, `minify_master`),
  `scraper/refresh_ticket_status.py`, `scraper/SCRAPING.md`, `scraper/README.md`, `js/app.js`
  (`adaptShow`, `NO_TICKETS_STATUSES`), `plan/lib/hydrate.js`, `.github/workflows/scrape.yml` and
  `.gitignore`.
- **Reason:** the scrape and its committed, index-encoded data layer carried reusable working
  knowledge no canon pack or the `edfringe` pack homed, and it was judged a distinct domain with its
  own trigger: touching the scraper or the data files rather than the UI.
- **Actor:** the growth-discover-packs run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a second local pack, `edfringe-data`, declared by hand as `local/edfringe-data`,
  with its own README (now `DATA.md`) and the `edfringe-lookup-indices` check.
- **Landed:** #116, Refs #105

## 2026-07-31 · scope-changed · manifests migrated to the routing-guidance schema (#175)
- **Reason:** the canon's new manifest schema; without it the new mount blocks on the manifest
  checks and the pack's own rules stop running.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** `ruleRoutingGuidance` added to each local manifest, `rules` split into
  `worldRules`, retired fields dropped.
- **Landed:** #175

## 2026-08-10 · scope-changed · the requirements harness gets its own pack, edfringe-requirements (#316)
- **Reason:** the executable spec landed with a real-headless-browser golden harness, and its
  process elements (the determinism traps, the fixture freeze, golden approval here) were ones the
  shared executable-requirements and spec-driven-product packs do not carry.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Fable 5
- **Mechanism:** a third local pack, `edfringe-requirements`, declared in `.claudinite-checks.json`.
- **Landed:** #316, Closes #313

## 2026-09-05 · merged · edfringe, edfringe-data and edfringe-requirements become edfringe-now (#613)
- **Source:** the fleet-wide one-local-pack-per-repo consolidation, missingbulb/Claudinite#1691.
- **Reason:** all three were declared by hand and none was fingerprinted, so a session loaded all
  three together on every turn; three manifests separated only which file a rule was typed into. The
  merged RULES.md (about 940 lines) was recorded on #612 as a known cost, its three surface headings
  the seams a later split would follow.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** one manifest, `edfringe-now`, declaration-authoritative with no fingerprint,
  carrying all seven checks and both tasks unchanged; `edfringe-data`'s README became `DATA.md`.
- **Rejected:** carrying the local `VERSIONS.md` files across - a local pack is neither versioned
  nor distributed, and its commits are its record.
- **Landed:** #613, Closes #612

## 2026-09-24 · scope-changed · data and harness judgment moved into two skills; unmarked sections pruned
- **Reason:** the owner reviewed the pack and asked to delete the issue-first rule ("Clean the local
  rule about opening issues first"), delete the local PR-polling section, trim every rule to zero
  story, re-verify the environment facts and drop the stale ones, and move data/harness to skills.
- **Source:** removed without a file of their own: the issue-first section (no check requires an
  issue reference any more, and basics tracks work by its PR), the Comment-class section
  (spec-driven-product's repo-tooling-never-feature carries it), the polling and
  subscribe_pr_activity sections, the comment-names-its-neighbour section (basics'
  writing-file-depends plus the claudinite-isolation check), the edfringe.com-CSS-via-curl note and
  the dated network observations.
- **Actor:** @missingbulb (owner).
- **Mechanism:** RULES.md keeps rules no file edit predicts; the data-pipeline and
  requirements-harness skills carry the rest behind force-load paths.
