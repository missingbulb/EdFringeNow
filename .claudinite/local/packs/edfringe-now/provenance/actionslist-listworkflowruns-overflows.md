## 2026-08-17 · born · Claudinite growth: extract lessons (#391)
- **Source:** #372 and #237.
- **Reason:** one session retried the same call at `per_page` 25, 10, 3, 2 and 1 and got a
  byte-identical overflow every time.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a RULES.md rule under "GitHub MCP call shapes that cost round-trips here".
- **Rejected:** a check - it constrains runtime tool behaviour, with no static signature in the
  tree.
- **Landed:** #391, Refs #389

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-13 · reworded · an explicit perPage does fix it (#694)
- **Source:** live re-probes on 2026-09-13.
- **Reason:** with no `perPage` the call overflowed at about 59K characters; with `perPage: 3` and
  `perPage: 1` it returned cleanly, so the rule's "lowering it does not help" no longer held.
- **Actor:** the rule-revalidation run, merged by @missingbulb (owner).
- **Landed:** #694, Refs #687

## 2026-09-24 · reaffirmed · still overflows without perPage
- **Source:** 2026-09-24: list_workflow_runs with no perPage returned 90,202 characters and
  overflowed.
- **Actor:** @missingbulb (owner).
