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

## 2026-09-27 · converted · guardToolCalls now exists in this pack (item #925)
- **Reason:** the 2026-08-17 rejection ("no static signature in the tree") predates this pack's own
  action-scope declarations (edfringe-no-review-request-from-pr-author, since 2026-09-26) — a tool
  call's input, judged before it runs, is exactly what guardToolCalls targets. Deletion test: the
  check's failure message and fix state the rule and the remedy in full — prose deleted whole.
- **Actor:** the prose-to-checks-sweep run, item #925.
- **Model:** Claude Sonnet 5
- **Mechanism:** edfringe-actions-list-workflow-runs-needs-perpage, a declared action-scope check.

## 2026-09-27 · retired · fully replaced by its converted check (item #925)
- **Reason:** the prose is deleted (see the converted entry above); no carrier names this file any
  longer.
- **Actor:** the prose-to-checks-sweep run, item #925.
